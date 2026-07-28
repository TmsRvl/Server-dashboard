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
    $fillter = "";
    if(!empty($_GET)){
        if(isset($_GET["dataini"]) && isset($_GET["datafin"])){
            if($_GET["dataini"] == $_GET["datafin"] && isset($_GET["oraini"])){    
                $fillter .= " AND connection.created_at BETWEEN '{$_GET['dataini']} {$_GET['oraini']}:00' AND '{$_GET['datafin']} {$_GET['orafin']}:00'";
            }else{
                $fillter .= " AND connection.created_at BETWEEN '{$_GET['dataini']} 00:00:00' AND '{$_GET['datafin']} 23:59:59'";
            }
        }
        if(isset($_GET["metodo"])){
            $fillter .= " AND req_method = '{$_GET['metodo']}'";
        }
    }

    $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name . ";charset=utf8", $username, $password);
    
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    $query = "SELECT 
            connection.id as id,
            DATE(connection.created_at) as data, 
            TIME(connection.created_at) as ora, 
            connection.req_method as metodo, 
            connection.req_uri as uri, 
            connection.res_code as code, 
            header.value as ip, 
            connection.res_time as tempo_risposta,
            connection.apache_time as tempo_apache,
            connection.proxy_time as tempo_proxy
            FROM connection 
            INNER JOIN connection_header ON connection.id = connection_header.connection_id 
            INNER JOIN header ON connection_header.header_id = header.id 
            WHERE header.name = 'X-Forwarded-For' {$fillter} 
			ORDER BY connection.created_at DESC
            ";
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

