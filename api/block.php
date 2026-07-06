<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET"); 

try {
    if (isset($_GET["tipo"]) && $_GET["tipo"] === "ip") {
        if (isset($_GET["mostra"]) && $_GET["mostra"] === "1") {
            # leggo il file e ritorno la lista degli ip bloccati
            $res = file("../data/ipBlocked.txt", FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "data" => $res
            ]);
        } else if (isset($_GET["blocca"]) && $_GET["blocca"] === "1"){
            # apro il file degli ip bloccati e aggiungo l'ip se è valido
            file_put_contents("../data/ipBlocked.txt", $testo, FILE_APPEND);
            http_response_code(200);
            echo json_encode([
                "status" => "success",
            ]);

        }
    }else if (isset($_GET["tipo"]) && $_GET["tipo"] === "uri") {
        if (isset($_GET["mostra"]) && $_GET["mostra"] === "1") {
            # leggo il file e ritorno la lista degli uri bloccati
            $res = file("../data/uriBlocked.txt", FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "data" => $res
            ]);
        } else if (isset($_GET["blocca"]) && $_GET["blocca"] === "1"){
            # apro il file degli uri bloccati e aggiungo l'uri 
            file_put_contents("../data/uriBlocked.txt", $testo, FILE_APPEND);
            http_response_code(200);
            echo json_encode([
                "status" => "success",
            ]);
        }
    }else {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Errore nel passaggio degli argomenti!"
        ]);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Errore: " . $e->getMessage()
    ]);
}
?>