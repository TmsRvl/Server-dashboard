<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
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
    if(!empty($_GET) && isset($_GET["id"])){
        $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name . ";charset=utf8", $username, $password);
    
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        $query1 = "SELECT *
                FROM connection
                WHERE id = {$_GET["id"]}";
        $query2 = "SELECT 
                h.name AS header_nome,
                h.value AS header_valore,
                ch.type AS tipo_header 
                FROM 
                    connection_header ch
                JOIN 
                    header h ON ch.header_id = h.id
                WHERE 
                    ch.connection_id = {$_GET["id"]}";

        $stmt = $conn->prepare($query1);
        $stmt->execute();

        $res = $stmt->fetchAll();

        $stmt = $conn->prepare($query2);
        $stmt->execute();

        $headers = $stmt->fetchAll();

        http_response_code(200);
        echo json_encode([
            "status" => "success",
            "connection" => $res,
            "headers" => $headers
        ]);
    } else {
        http_response_code(400);
        echo json_encode([
            "status" => "Bad Request",
        ]);
    }

} catch (PDOException $exception) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Errore di connessione o query fallita: " . $exception->getMessage()
    ]);
}
?>
