<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");


$host     = "localhost";
$db_name  = "http_logs";
$username = "log_user";
$password = "password";

try {
    $conn = new PDO("mysql:host={$host};dbname={$db_name};charset=utf8", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

	$intervallo = 3; 

	$query = "SELECT 
            DATE_FORMAT(
              FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(created_at) / {$intervallo}) * {$intervallo}),
              '%Y-%m-%d %H:%i:%s'
            )                                           AS secondo,
            COUNT(id)                                   AS tot_connessioni,
            ROUND(AVG(res_time), 2)                     AS avg_res_time,
            ROUND(AVG(apache_time), 2)                  AS avg_apache_time,
            ROUND(AVG(cpu), 2)                          AS avg_cpu,
            ROUND(AVG(ram), 2)                          AS avg_ram
          FROM connection
          WHERE created_at >= NOW() - INTERVAL 3600 SECOND
          GROUP BY secondo 
          ORDER BY secondo ASC";
    $stmt = $conn->query($query);
    $risultati = $stmt->fetchAll();

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "count"  => count($risultati),
        "data"   => $risultati
    ]);

} catch (PDOException $exception) {
    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "Errore DB: " . $exception->getMessage()
    ]);
}
