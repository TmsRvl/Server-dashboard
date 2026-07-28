#!/bin/bash

AZIONE=$1
IP=$2

#validazione IP 
if [[ ! $IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Errore: Formato IP non valido"
    exit 1
fi

if [ "$AZIONE" == "blocca" ]; then
    /sbin/iptables -A INPUT -p tcp -m multiport --dports 80,443 -s "$IP" -j REJECT --reject-with tcp-reset
elif [ "$AZIONE" == "sblocca" ]; then
    /sbin/iptables -D INPUT -p tcp -m multiport --dports 80,443 -s "$IP" -j REJECT --reject-with tcp-reset
else
    echo "Azione non riconosciuta"
    exit 1
fi
