<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET"); 

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = "localhost";
$db_name = "http_logs";
$username = "log_user";
$password = "password";

try {
    $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name . ";charset=utf8", $username, $password);
    
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    $query = "SELECT 
            DATE(connection.created_at) as data, 
            TIME(connection.created_at) as ora, 
            connection.req_method as metodo, 
            connection.req_uri as uri, 
            connection.res_code as code, 
            header.value as ip, 
            connection.res_time as tempo 
            FROM connection 
            INNER JOIN connection_header ON connection.id = connection_header.connection_id 
            INNER JOIN header ON connection_header.header_id = header.id 
            WHERE header.name = 'X-Forwarded-For' 
			ORDER BY connection.created_at DESC
            LIMIT 50";
    $stmt = $conn->prepare($query);
    $stmt->execute();

    $risultati = $stmt->fetchAll();

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "data" => $risultati
    ]);

} catch (PDOException $exception) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Errore di connessione o query fallita: " . $exception->getMessage()
    ]);
}
?>
