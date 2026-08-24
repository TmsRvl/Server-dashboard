#define _GNU_SOURCE

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <time.h>
#include <signal.h>
#include <sys/file.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/time.h>
#include <regex.h>
#include <sys/sysinfo.h>
#include <pthread.h>
#include <stdatomic.h>
#include <sys/mman.h>

struct header {
    char n[32];
    char v[256];
};

struct http_session {
    // Richiesta
    char method[10], uri[2000], req_ver[10];
    struct header req_headers[100];
    int req_h_count;
    time_t time;

    // Risposta
    char res_ver[10], phrase[50];
    int status_code;
    struct header res_headers[100];
    int res_h_count;

    // Metriche Temporali (in millisecondi)
    double response_time; // Tempo totale visto dal proxy verso il backend 81
    double apache_time;   // Tempo estratto dal log di Apache 443
    double proxy_time;    // Overhead proxy (isBlocked)

    // Metriche di Sistema
    double cpu;
    double ram;
};

// Memoria condivisa tra i processi figli generati con fork()
typedef struct {
    _Atomic double cpu_usage;
    _Atomic double ram_usage;
    _Atomic int running;
} SharedMetrics;

static SharedMetrics *g_metrics = NULL;

typedef struct {
    unsigned long long user, nice, system, idle, iowait, irq, softirq, steal;
} CpuTicks;

// Funzione tempo ad alta precisione (Wall-Clock reale)
double get_time_ms(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (double)t.tv_sec * 1000.0 + (double)t.tv_nsec / 1000000.0;
}

// Lettura dei tick di /proc/stat
static int read_cpu_ticks(CpuTicks *ticks) {
    FILE *fp = fopen("/proc/stat", "r");
    if (!fp) return -1;

    char buffer[256];
    if (fgets(buffer, sizeof(buffer), fp) != NULL) {
        sscanf(buffer, "cpu %llu %llu %llu %llu %llu %llu %llu %llu",
               &ticks->user, &ticks->nice, &ticks->system, &ticks->idle,
               &ticks->iowait, &ticks->irq, &ticks->softirq, &ticks->steal);
    }
    fclose(fp);
    return 0;
}

// Calcolo RAM usata reale tramite MemAvailable
static double calculate_ram_percentage(void) {
    FILE *fp = fopen("/proc/meminfo", "r");
    if (!fp) return 0.0;

    char line[256];
    unsigned long long mem_total = 0;
    unsigned long long mem_available = 0;
    int found = 0;

    while (fgets(line, sizeof(line), fp)) {
        if (sscanf(line, "MemTotal: %llu kB", &mem_total) == 1) found++;
        else if (sscanf(line, "MemAvailable: %llu kB", &mem_available) == 1) found++;
        if (found == 2) break;
    }
    fclose(fp);

    if (mem_total == 0 || found < 2) return 0.0;
    unsigned long long used_ram = mem_total - mem_available;
    return ((double)used_ram / (double)mem_total) * 100.0;
}

// Thread dedicato al campionamento in background
void* metrics_worker_thread(void *arg) {
    (void)arg;
    CpuTicks prev_ticks, curr_ticks;

    if (read_cpu_ticks(&prev_ticks) != 0) {
        memset(&prev_ticks, 0, sizeof(CpuTicks));
    }

    while (atomic_load(&g_metrics->running)) {
        usleep(200 * 1000); // Finestra di campionamento a 200ms

        if (read_cpu_ticks(&curr_ticks) == 0) {
            unsigned long long prev_idle = prev_ticks.idle + prev_ticks.iowait;
            unsigned long long curr_idle = curr_ticks.idle + curr_ticks.iowait;

            unsigned long long prev_non_idle = prev_ticks.user + prev_ticks.nice +
                                               prev_ticks.system + prev_ticks.irq +
                                               prev_ticks.softirq + prev_ticks.steal;
            unsigned long long curr_non_idle = curr_ticks.user + curr_ticks.nice +
                                               curr_ticks.system + curr_ticks.irq +
                                               curr_ticks.softirq + curr_ticks.steal;

            unsigned long long total_prev = prev_idle + prev_non_idle;
            unsigned long long total_curr = curr_idle + curr_non_idle;

            unsigned long long total_delta = total_curr - total_prev;
            unsigned long long idle_delta = curr_idle - prev_idle;

            if (total_delta > 0) {
                double cpu = (double)(total_delta - idle_delta) * 100.0 / (double)total_delta;
                atomic_store(&g_metrics->cpu_usage, cpu);
            }

            prev_ticks = curr_ticks;
        }

        atomic_store(&g_metrics->ram_usage, calculate_ram_percentage());
    }

    return NULL;
}

void print_escaped_json(FILE *f, const char *str) {
    if (!str) return;
    if (*str == ' ') str++;

    while (*str) {
        if (*str == '"' || *str == '\\') {
            fputc('\\', f);
        }
        fputc(*str, f);
        str++;
    }
}

void save_session(struct http_session *hs) {
    time_t rawtime = time(NULL);
    char filename[64];

    sprintf(filename, "log/%ld_pid_%d.json", rawtime, getpid());

    FILE *f = fopen(filename, "w");
    if (!f) return;

    fprintf(f, "  {\n    \"connection\": {\n");

    // REQUEST
    fprintf(f, "      \"request\": {\n");
    fprintf(f, "        \"cpu\": \"%.2f\",\n", hs->cpu);
    fprintf(f, "        \"ram\": \"%.2f\",\n", hs->ram);
    fprintf(f, "        \"time\": \"%ld\",\n", hs->time);
    fprintf(f, "        \"version\": \"%s\",\n", hs->req_ver);
    fprintf(f, "        \"uri\": \"%s\",\n", hs->uri);
    fprintf(f, "        \"method\": \"%s\",\n", hs->method);
    fprintf(f, "        \"headers\": {\n");
    for (int i = 0; i < hs->req_h_count; i++) {
        fprintf(f, "          \"%s\": \"", hs->req_headers[i].n);
        print_escaped_json(f, hs->req_headers[i].v);
        fprintf(f, "\"%s\n", (i < hs->req_h_count - 1) ? "," : "");
    }
    fprintf(f, "        }\n      },\n");

    // RESPONSE
    fprintf(f, "      \"response\": {\n");
    fprintf(f, "        \"version\": \"%s\",\n", hs->res_ver);
    fprintf(f, "        \"status-code\": %d,\n", hs->status_code);
    fprintf(f, "        \"phrase\": \"%s\",\n", hs->phrase);
    fprintf(f, "        \"time-response\": %.2f,\n", hs->response_time);
    fprintf(f, "        \"apache-time\": %.2f,\n", hs->apache_time);
    fprintf(f, "        \"proxy_time\": %.2f,\n", hs->proxy_time);
    fprintf(f, "        \"headers\": {\n");
    for (int i = 0; i < hs->res_h_count; i++) {
        fprintf(f, "          \"%s\": \"", hs->res_headers[i].n);
        print_escaped_json(f, hs->res_headers[i].v);
        fprintf(f, "\"%s\n", (i < hs->res_h_count - 1) ? "," : "");
    }

    fprintf(f, "        }\n      }\n    }\n  }\n");

    fflush(f);
    fclose(f);
}

void parse(char* buff, int buff_len, int mod, struct http_session *hs) {
    if (strstr(buff, "\r\n\r\n") == NULL) return;

    int i = 0;
    int lettoNomeHeader = 0;
    int headerIndex = 0;

    while (i < buff_len) {
        if (buff[i] == '\n' && buff[i - 1] == '\r') {
            if (buff[i - 3] == 0) break;
            lettoNomeHeader = 0;
            buff[i - 1] = 0;
            if (mod == 0) {
                sscanf(buff + i + 1, "%[^:]", hs->req_headers[headerIndex].n);
            } else {
                sscanf(buff + i + 1, "%[^:]", hs->res_headers[headerIndex].n);
            }
        } else if (!lettoNomeHeader && buff[i] == ':') {
            lettoNomeHeader = 1;
            buff[i] = 0;
            if (mod == 0) {
                sscanf(buff + i + 1, "%[^\r\n]", hs->req_headers[headerIndex++].v);
            } else {
                sscanf(buff + i + 1, "%[^\r\n]", hs->res_headers[headerIndex++].v);
            }
        }
        i++;
    }

    if (mod == 0) {
        hs->req_h_count = headerIndex;
        sscanf(buff, "%s %s %[^\r\n]", hs->method, hs->uri, hs->req_ver);
    } else {
        hs->res_h_count = headerIndex;
        sscanf(buff, "%s %d %[^\r\n]", hs->res_ver, &hs->status_code, hs->phrase);
    }
}

void forward(int src, int dest, int mod, struct http_session *hs) {
    char buffer[8192];
    char buffer_cpy[8192];
    int bytes_read, bytes_written;
    int is_first_chunk = 1;
    long long content_length = -1;
    long long total_bytes_transferred = 0;
    int is_chunked = 0;

    double t_start = 0.0;
    if (mod == 1) {
        t_start = get_time_ms();
    }

    while ((bytes_read = read(src, buffer, sizeof(buffer) - 1)) > 0) {
        if (is_first_chunk) {
            memcpy(buffer_cpy, buffer, bytes_read);
            buffer_cpy[bytes_read] = '\0';
            parse(buffer_cpy, bytes_read, mod, hs);
            is_first_chunk = 0;

            if (mod == 0) {
                int to_send = bytes_read;
                int sent = 0;
                while (sent < to_send) {
                    bytes_written = write(dest, buffer + sent, to_send - sent);
                    if (bytes_written <= 0) return;
                    sent += bytes_written;
                }
                hs->time = time(NULL);
                break;
            }

            if (mod == 1) {
                for (int h = 0; h < hs->res_h_count; h++) {
                    if (strcasecmp(hs->res_headers[h].n, "Content-Length") == 0) {
                        content_length = atoll(hs->res_headers[h].v);
                    } else if (strcasecmp(hs->res_headers[h].n, "Transfer-Encoding") == 0) {
                        if (strstr(hs->res_headers[h].v, "chunked") != NULL) {
                            is_chunked = 1;
                        }
                    }
                }

                char *body_start = strstr(buffer_cpy, "\r\n\r\n");
                if (body_start != NULL) {
                    body_start += 4;
                    long long header_len = body_start - buffer_cpy;
                    total_bytes_transferred += (bytes_read - header_len);
                }
            }
        } else if (mod == 1) {
            total_bytes_transferred += bytes_read;
        }

        int total_written = 0;
        while (total_written < bytes_read) {
            bytes_written = write(dest, buffer + total_written, bytes_read - total_written);
            if (bytes_written <= 0) return;
            total_written += bytes_written;
        }

        if (mod == 1 && content_length >= 0 && total_bytes_transferred >= content_length) {
            break;
        }

        buffer[bytes_read] = '\0';
        if (mod == 1 && is_chunked && strstr(buffer, "0\r\n\r\n") != NULL) {
            break;
        }
    }

    if (mod == 1) {
        double t_stop = get_time_ms();
        hs->response_time = t_stop - t_start;
        if (hs->response_time < 0) hs->response_time = -hs->response_time;
    }
}

int isBlocked(struct http_session *hs) {
    int block = 0;
    char line[2000];

    FILE *f_uri = fopen("./data/uriBlocked.txt", "r");
    if (f_uri != NULL) {
        while (fgets(line, sizeof(line), f_uri)) {
            char* a = strstr(line, "\r");
            if (!a) a = strstr(line, "\n");
            if (a) *a = '\0';

            int cflags = REG_EXTENDED;
            char *nc_flag = strstr(line, " [NC]");
            if (nc_flag != NULL) {
                cflags |= REG_ICASE;
                *nc_flag = '\0';
            }

            regex_t regex;
            if (regcomp(&regex, line, cflags) == 0) {
                if (regexec(&regex, hs->uri, 0, NULL, 0) == 0) {
                    block = 1;
                    regfree(&regex);
                    break;
                }
                regfree(&regex);
            }
        }
        fclose(f_uri);
    }
    return block;
}

// Funzione dedicata a estrarre il tempo dal file di log con ID univoco
double fetch_apache_time_from_log(const char *req_id) {
    if (!req_id || strlen(req_id) == 0) return 0.0;

    for (int retry = 0; retry < 20; retry++) {
        FILE *f_log = fopen("/var/log/apache2/apache_time_access.log", "r");
        if (f_log) {
            char log_line[512];
            while (fgets(log_line, sizeof(log_line), f_log)) {
                if (strstr(log_line, req_id) != NULL) {
                    char *time_str = strstr(log_line, "TIME:");
                    if (time_str) {
                        long long apache_us = 0;
                        if (sscanf(time_str + 5, "%lld", &apache_us) == 1) {
                            fclose(f_log);
                            if (apache_us < 0) apache_us = -apache_us;
                            return (double)apache_us / 1000.0;
                        }
                    }
                }
            }
            fclose(f_log);
        }
        usleep(5000); // 5ms per tentativo (100ms max totali)
    }
    return 0.0;
}

int main(void) {
    int proxy_fd, client_fd, server_fd;
    struct sockaddr_in proxy, server;

    g_metrics = mmap(NULL, sizeof(SharedMetrics), PROT_READ | PROT_WRITE,
                     MAP_SHARED | MAP_ANONYMOUS, -1, 0);
    if (g_metrics == MAP_FAILED) {
        perror("mmap fallita");
        exit(1);
    }

    atomic_store(&g_metrics->cpu_usage, 0.0);
    atomic_store(&g_metrics->ram_usage, 0.0);
    atomic_store(&g_metrics->running, 1);

    pthread_t monitor_tid;
    if (pthread_create(&monitor_tid, NULL, metrics_worker_thread, NULL) != 0) {
        perror("Errore thread monitoraggio");
        exit(1);
    }

    proxy_fd = socket(AF_INET, SOCK_STREAM, 0);
    int opt = 1;
    setsockopt(proxy_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    proxy.sin_family = AF_INET;
    proxy.sin_addr.s_addr = INADDR_ANY;
    proxy.sin_port = htons(8080);

    bind(proxy_fd, (struct sockaddr *)&proxy, sizeof(proxy));
    listen(proxy_fd, 100);

    signal(SIGCHLD, SIG_IGN);

    while (1) {
        client_fd = accept(proxy_fd, NULL, NULL);
        if (client_fd < 0) continue;

        if (fork() == 0) {
            close(proxy_fd);
            server_fd = socket(AF_INET, SOCK_STREAM, 0);
            server.sin_family = AF_INET;
            server.sin_port = htons(81);
            server.sin_addr.s_addr = inet_addr("127.0.0.1");

            if (connect(server_fd, (struct sockaddr *)&server, sizeof(server)) == 0) {
                struct http_session session;
                memset(&session, 0, sizeof(session));

                // 1. Inoltro richiesta dal client (Apache 443) al backend 81
                forward(client_fd, server_fd, 0, &session);

                // 2. Misura isBlocked
                double ini_blocked = get_time_ms();
                int blocked = isBlocked(&session);
                double fin_blocked = get_time_ms();
                session.proxy_time = fin_blocked - ini_blocked;

                session.apache_time = 0.0;
                session.response_time = 0.0;
                char *req_id = NULL;

                if (!blocked) {
                    // 3. Ricezione risposta da Apache 81
                    forward(server_fd, client_fd, 1, &session);

                    // 4. Cerca X-Request-ID inviato da Apache 443
                    for (int i = 0; i < session.req_h_count; i++) {
                        char *name = session.req_headers[i].n;
                        while (*name == ' ' || *name == '\r' || *name == '\n') name++;
                        if (strcasecmp(name, "X-Request-ID") == 0) {
                            req_id = session.req_headers[i].v;
                            while (*req_id == ' ') req_id++;
                            break;
                        }
                    }
                } else {
                    const char *response = "HTTP/1.1 403 Forbidden\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><body><h1>403 Forbidden</h1></body></html>";
                    session.res_h_count = 0;
                    strcpy(session.res_ver, "HTTP/1.1");
                    strcpy(session.phrase, "Forbidden");
                    session.status_code = 403;
                    write(client_fd, response, strlen(response));
                    session.response_time = 0.0;
                }

                // Chiude subito i socket per forzare Apache 443 a terminare la sessione e fare il flush del log
                close(server_fd);
                close(client_fd);

                // 5. Estrae il tempo dal file di log solo a connessione terminata
                if (!blocked && req_id) {
                    session.apache_time = fetch_apache_time_from_log(req_id);
                }

                session.cpu = atomic_load(&g_metrics->cpu_usage);
                session.ram = atomic_load(&g_metrics->ram_usage);

                save_session(&session);
                exit(0);
            }

            close(server_fd);
            close(client_fd);
            exit(0);
        }
        close(client_fd);
    }

    atomic_store(&g_metrics->running, 0);
    pthread_join(monitor_tid, NULL);
    munmap(g_metrics, sizeof(SharedMetrics));
    close(proxy_fd);
    return 0;
}
