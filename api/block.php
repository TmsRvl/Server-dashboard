<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");

$fileIp = __DIR__ . "/../data/ipBlocked.txt";
$fileUri = __DIR__ . "/../data/uriBlocked.txt";

try {
    if (isset($_GET["tipo"]) && $_GET["tipo"] === "ip") {
        if (isset($_GET["mostra"]) && $_GET["mostra"] === "1") {
            $res = file_exists($fileIp) ? file($fileIp, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "data" => $res
            ]);
        } else if (isset($_GET["blocca"]) && $_GET["blocca"] === "1" && isset($_GET["data"])) {
            $nuovoIp = trim($_GET["data"]);

            $listaIp = file_exists($fileIp) ? file($fileIp, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];
            
            if (in_array($nuovoIp, $listaIp, true)) {
                http_response_code(409); // 409 Conflict (Risorsa già esistente)
                echo json_encode([
                    "status" => "error",
                    "message" => "L'IP inserito è già presente nella blacklist.",
                    "data" => $listaIp
                ]);
                exit;
            }

            $datoDaScrivere = $nuovoIp . PHP_EOL;
            $res = file_put_contents($fileIp, $datoDaScrivere, FILE_APPEND | LOCK_EX);

            if ($res === false) {
                throw new Exception("Impossibile scrivere nel file IP. Controlla i permessi della cartella 'data'.");
            }

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "data" => $nuovoIp
            ]);
        } else if (isset($_GET["blocca"]) && $_GET["blocca"] === "0" && isset($_GET["data"])){
            $ipDaSbloccare = trim($_GET["data"]);

            $listaIp = file_exists($fileIp) ? file($fileIp, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];
            
            if (!in_array($ipDaSbloccare, $listaIp, true)) {
                http_response_code(404); // Not Found
                echo json_encode([
                    "status" => "error",
                    "message" => "L'IP specificato non è presente nella blacklist."
                ]);
                exit;
            }

            $listaAggiornata = array_diff($listaIp, [$ipDaSbloccare]);

            $nuovoContenuto = "";
            if (sizeof($listaAggiornata) > 0) {
                foreach($listaAggiornata as $v){
                    $nuovoContenuto .= "$v\n";
                }
            }else {
                $nuovoContenuto = "";
            }
            
            $res = file_put_contents($fileIp, $nuovoContenuto, LOCK_EX);

            if ($res === false) {
                throw new Exception("Impossibile aggiornare il file IP. Controlla i permessi della cartella 'data'.");
            }

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "message" => "IP rimosso correttamente dalla blacklist.",
                "data" => $ipDaSbloccare
            ]);
        } else {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "Parametri errati"
            ]);
        }
    } else if (isset($_GET["tipo"]) && $_GET["tipo"] === "uri") {
        if (isset($_GET["mostra"]) && $_GET["mostra"] === "1") {
            $res = file_exists($fileUri) ? file($fileUri, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "data" => $res
            ]);
        } else if (isset($_GET["blocca"]) && $_GET["blocca"] === "1" && isset($_GET["data"])) {
            $nuovoUri = trim($_GET["data"]);

            $listaUri = file_exists($fileUri) ? file($fileUri, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];
            
            if (in_array($nuovoUri, $listaUri, true)) {
                http_response_code(409); 
                echo json_encode([
                    "status" => "error",
                    "message" => "L'URI inserito è già presente nella blacklist."
                ]);
                exit;
            }
            
            $datoDaScrivere = $nuovoUri . PHP_EOL;
            $res = file_put_contents($fileUri, $datoDaScrivere, FILE_APPEND | LOCK_EX);

            if ($res === false) {
                throw new Exception("Impossibile scrivere nel file URI. Controlla i permessi della cartella 'data'.");
            }

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "data" => $nuovoUri
            ]);
        } else if (isset($_GET["blocca"]) && $_GET["blocca"] === "0" && isset($_GET["data"])) {
            # devo sbloccare un certo uri
            $uriDaSbloccare = trim($_GET["data"]);

            $listaUri = file_exists($fileUri) ? file($fileUri, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];
            
            if (!in_array($uriDaSbloccare, $listaUri, true)) {
                http_response_code(404); // Not Found
                echo json_encode([
                    "status" => "error",
                    "message" => "L'URI specificato non è presente nella blacklist."
                ]);
                exit;
            }

            $listaAggiornata = array_diff($listaUri, [$uriDaSbloccare]);
            
            $nuovoContenuto = "";
            if (sizeof($listaAggiornata) > 0) {
                foreach($listaAggiornata as $v){
                    $nuovoContenuto .= "$v\n";
                }
            }else {
                $nuovoContenuto = "";
            }
            
            $res = file_put_contents($fileUri, $nuovoContenuto, LOCK_EX);

            if ($res === false) {
                throw new Exception("Impossibile aggiornare il file URI. Controlla i permessi della cartella 'data'.");
            }

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "message" => "URI rimosso correttamente dalla blacklist.",
                "data" => $uriDaSbloccare
            ]);
        } else {
            http_response_code(400);
            echo json_encode([
                "status" => "error",
                "message" => "Parametri errati"
            ]);
        }
    } else {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Parametri errati"
        ]);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Errore di sistema: " . $e->getMessage()
    ]);
}
?>
