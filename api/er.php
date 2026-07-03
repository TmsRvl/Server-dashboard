<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET"); 

$host = "localhost";
$db_name = "http_logs";
$username = "log_user";
$password = "password";

try {
    $fillter = "1";
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
            (SUM(res_code NOT BETWEEN 200 AND 299) * 100.0) / COUNT(*) AS er
            FROM connection
            WHERE {$fillter}";
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
