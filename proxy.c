#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <signal.h>
#include <sys/file.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/time.h>

struct header{
    char n[32];
    char v[256];
};

struct timer{
    clock_t start;
    clock_t stop;
};

struct http_session {
    // Richiesta
    char method[10], uri[2000], req_ver[10];
    struct header req_headers[100];
    int req_h_count;
	time_t time;    //implementare il salvataggio di quando arriva la richiesta.

    // Risposta
    char res_ver[10], phrase[50];
    int status_code;
    struct header res_headers[100];
    int res_h_count;
    double response_time;
};

void print_escaped_json(FILE *f, const char *str) {
    if (!str) return;

    // Salta lo spazio iniziale residuo del parsing HTTP
    if (*str == ' ') {
        str++;
    }

    while (*str) {
        if (*str == '"' || *str == '\\') {
            fputc('\\', f);
        }
        fputc(*str, f);
        str++;
    }
}

void save_session(struct http_session *hs) {
    // 1. Genera il nome del file basato sull'orario corrente (HH-MM.json)
    time_t rawtime = time(NULL);
    char filename[32];

    // Genera una stringa come "20-15.json"
    sprintf(filename, "log/%ld_pid_%d.json", rawtime, getpid());

    // 2. Apriamo in "r+" (lettura e scrittura senza troncare)
    FILE *f = fopen(filename, "w");
    if (!f) return;
        

    // ==================== SCRITTURA DATI ====================
    fprintf(f, "  {\n    \"connection\": {\n");

    // REQUEST
    fprintf(f, "      \"request\": {\n");
    fprintf(f, "        \"time\": \"%ld\",\n", hs->time);
    fprintf(f, "        \"version\": \"%s\",\n", hs->req_ver);
    fprintf(f, "        \"uri\": \"%s\",\n", hs->uri);
    fprintf(f, "        \"method\": \"%s\",\n", hs->method);
    fprintf(f, "        \"headers\": {\n");
    for(int i = 0; i < hs->req_h_count; i++) {
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
    fprintf(f, "        \"headers\": {\n");
    for(int i = 0; i < hs->res_h_count; i++) {
        fprintf(f, "          \"%s\": \"", hs->res_headers[i].n);
        print_escaped_json(f, hs->res_headers[i].v);
        fprintf(f, "\"%s\n", (i < hs->res_h_count - 1) ? "," : "");
    }

    // Chiusura dell'oggetto corrente E chiusura dell'array JSON
    fprintf(f, "        }\n      }\n    }\n  }\n");

    fflush(f);
    fclose(f);
}

void parse(char* buff, int buff_len, int mod, struct timer *t, struct http_session *hs){  // mod = 0 request, mod = 1 response, in base a questo avvia o stoppa il timer
    char* statusLine;

    // timer stop se mod = 1
    // if(mod == 1) {t->stop = clock();}  è sbagliato qui

    if(strstr(buff, "\r\n\r\n") == NULL) return; //se non ci sono tutti gli header

    int i = 0;
    int lettoNomeHeader = 0;
    int headerIndex = 0;
    //leggo fino a fine header
    while (i < buff_len) {
        if (buff[i] == '\n' && buff[i - 1] == '\r')
        {
            if (buff[i - 3] == 0){break;}
            lettoNomeHeader = 0;
            buff[i - 1] = 0;
            if(mod == 0){
                sscanf(buff+i+1, "%[^:]", hs->req_headers[headerIndex].n);
            }else{
                sscanf(buff+i+1, "%[^:]", hs->res_headers[headerIndex].n);
            }
        }
        else if (!lettoNomeHeader && buff[i] == ':')
        {
            lettoNomeHeader = 1;
            buff[i] = 0;
            if(mod == 0){
                sscanf(buff+i+1, "%[^\r\n]", hs->req_headers[headerIndex++].v);
            }else{
                sscanf(buff+i+1, "%[^\r\n]", hs->res_headers[headerIndex++].v);
            }
        }

        i++;
    }
    statusLine = buff;

    if (mod == 0) {
        hs->req_h_count = headerIndex - 1;
        sscanf(buff, "%s %s %[^\r\n]", hs->method, hs->uri, hs->req_ver);
    } else {
        hs->res_h_count = headerIndex - 1;
        sscanf(buff, "%s %d %[^\r\n]", hs->res_ver, &hs->status_code, hs->phrase);
        //hs->response_time = ((double) (t->stop - t->start) * 1000.0)/ CLOCKS_PER_SEC;
    }

    // timer start se mod = 0
    if(mod == 0){t->start = clock();}
}

/*
void forward(int src, int dest, int mod, struct timer *t, struct http_session *hs) {
    char buffer[8192];  // limite apache per header circa 8kb
    char buffer_cpy[8192];
    int bytes_read, bytes_written;

    bytes_read = read(src, buffer, sizeof(buffer) - 1);
    if (bytes_read <= 0) return;

    memcpy(buffer_cpy, buffer, bytes_read);
    buffer_cpy[bytes_read] = '\0';
    parse(buffer_cpy, bytes_read, mod, t, hs);


// Inviamo il primo blocco a destinazione
    bytes_written = write(dest, buffer, bytes_read);
    if (bytes_written <= 0) return;

    // Se il pacchetto era parziale o è un contenuto lungo (es. codice 206 o 200 con immagini),
    // continuiamo a inoltrare i dati finché il mittente non smette di mandarne o chiude il canale.
    // Usiamo un controllo non bloccante basato sulla dimensione letta
    while (bytes_read == sizeof(buffer) - 1) {
        bytes_read = read(src, buffer, sizeof(buffer) - 1);
        if (bytes_read <= 0) break;

        bytes_written = write(dest, buffer, bytes_read);
        if (bytes_written <= 0) break;
    }

    write(dest, buffer, bytes_read);

    while (bytes_read >= sizeof(buffer)-1 && ((bytes_read = read(src, buffer, sizeof(buffer))) > 0)) {  //invia il resto del pacchetto se c'è
        write(dest, buffer, bytes_read);
        if (bytes_written < 0) {
            break;
        }
    }
    //fine risposta server
    t->stop = clock();
    hs->response_time = ((double) (t->stop - t->start) * 1000.0) / CLOCKS_PER_SEC;
}
*/

void forward(int src, int dest, int mod, struct timer *t, struct http_session *hs) {
    char buffer[8192];
    char buffer_cpy[8192];
    int bytes_read, bytes_written;
    int is_first_chunk = 1;
    
    long long content_length = -1;
    long long total_bytes_transferred = 0;

    while ((bytes_read = read(src, buffer, sizeof(buffer))) > 0) {
        
        if (is_first_chunk) {
            memcpy(buffer_cpy, buffer, bytes_read);
            buffer_cpy[bytes_read] = '\0';
            parse(buffer_cpy, bytes_read, mod, t, hs);
            is_first_chunk = 0;

            // Se siamo in modalità risposta, cerchiamo il Content-Length negli header appena letti
            if (mod == 1) {
                for (int h = 0; h < hs->res_h_count; h++) {
                    if (strcasecmp(hs->res_headers[h].n, "Content-Length") == 0) {
                        content_length = atoll(hs->res_headers[h].v);
                        break;
                    }
                }
                
                // Calcoliamo quanti byte di "body" (immagine) erano già presenti nel primo blocco oltre agli header
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

        // SCRITTURA ROBUSTA: garantisce che tutto il buffer letto venga inviato, 
        // gestendo eventuali buffer di rete saturi lato browser
        int total_written = 0;
        while (total_written < bytes_read) {
            bytes_written = write(dest, buffer + total_written, bytes_read - total_written);
            if (bytes_written <= 0) {
                return; // Il socket di destinazione si è chiuso bruscamente, usciamo
            }
            total_written += bytes_written;
        }
        
        // Se è una richiesta GET (mod == 0), usciamo subito dopo il primo invio degli header
        if (mod == 0) {
			//qui ho effettivamente ricevuto la richiesta
			hs->time = time(NULL);
            break; 
        }

        // Se abbiamo raggiunto o superato i byte dichiarati nel Content-Length, 
        // interrompiamo il ciclo senza aspettare la chiusura del socket. Niente più caricamenti infiniti!
        if (mod == 1 && content_length > 0 && total_bytes_transferred >= content_length) {
            break;
        }
    }
//fine risposta server
    t->stop = clock();
    hs->response_time = ((double) (t->stop - t->start) * 1000.0) / CLOCKS_PER_SEC;
}

int main() {
    int proxy_fd, client_fd, server_fd;
    struct sockaddr_in proxy, server;

    proxy_fd = socket(AF_INET, SOCK_STREAM, 0);
    int opt = 1;
    setsockopt(proxy_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    proxy.sin_family = AF_INET;
    proxy.sin_addr.s_addr = INADDR_ANY;
    proxy.sin_port = htons(8080);

    bind(proxy_fd, (struct sockaddr *)&proxy, sizeof(proxy));
    listen(proxy_fd, 10);

    //printf("Proxy C in ascolto su 8080...\n");

    signal(SIGCHLD, SIG_IGN); // evita di tenere attivi processi zombie

    while (1) {
        client_fd = accept(proxy_fd, NULL, NULL);
        //printf("Nuova connessione\n");

        if (fork() == 0) { // processo figlio
            server_fd = socket(AF_INET, SOCK_STREAM, 0);
            server.sin_family = AF_INET;
            server.sin_port = htons(81);
            server.sin_addr.s_addr = inet_addr("127.0.0.1");

            if (connect(server_fd, (struct sockaddr *)&server, sizeof(server)) == 0) {
                struct timer t;
                struct http_session session;
                t.start = 0;
                t.stop = 0;
                forward(client_fd, server_fd, 0, &t, &session);
                forward(server_fd, client_fd, 1, &t, &session);

                save_session(&session);
            }
            close(server_fd);
            close(client_fd);
            exit(0);
        }
        close(client_fd);
    }
    return 0;
}
