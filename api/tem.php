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
    $differenza = 0;
    $sameday = 0;
    $filter = "1=1";
    if(!empty($_GET)){
        if(isset($_GET["dataini"]) && isset($_GET["datafin"])){
            $inizio = new DateTime($_GET["dataini"]);
            $fine = new DateTime($_GET["datafin"]);
            $differenza = $inizio->diff($fine);
            if($_GET["dataini"] == $_GET["datafin"]) {$sameday = 1;}
            if($_GET["dataini"] == $_GET["datafin"] && isset($_GET["oraini"])){    
                $filter .= " AND connection.created_at BETWEEN '{$_GET['dataini']} {$_GET['oraini']}:00' AND '{$_GET['datafin']} {$_GET['orafin']}:00'";
            }else{
                $filter .= " AND connection.created_at BETWEEN '{$_GET['dataini']} 00:00:00' AND '{$_GET['datafin']} 23:59:59'";
            }
        }
        if(isset($_GET["metodo"])){
            $filter .= " AND req_method = '{$_GET['metodo']}'";
        }
    }

    $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name . ";charset=utf8", $username, $password);
    
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    if($sameday === 1){
        $query = "SELECT 
            DATE_FORMAT(FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(created_at) / (15 * 60)) * (15 * 60)),'%d-%m %H:%i') AS tempo,
            (SUM(res_code NOT BETWEEN 200 AND 299) * 100.0) / COUNT(*) AS tem
            FROM connection
            WHERE {$filter}
            GROUP BY tempo
            ORDER BY tempo";
    }else if ($differenza->days < 3 && !empty($_GET)){
        $query = "SELECT 
            DATE_FORMAT(created_at, '%d-%m %H:00') AS tempo,
            (SUM(res_code NOT BETWEEN 200 AND 299) * 100.0) / COUNT(*) AS tem
            FROM connection
            WHERE {$filter}
            GROUP BY tempo
            ORDER BY tempo";
    }else {
        $query = "SELECT 
            DATE_FORMAT(created_at, '%d-%m') AS tempo,
            (SUM(res_code NOT BETWEEN 200 AND 299) * 100.0) / COUNT(*) AS tem
            FROM connection
            WHERE {$filter}
            GROUP BY tempo
            ORDER BY tempo";
    }

    
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
