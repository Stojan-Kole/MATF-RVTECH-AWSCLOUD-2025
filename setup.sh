#!/bin/bash

echo "Resetujem i pokrećem MATF RVTECH projekat..."

echo "Čistim stare kontejnere i privremene fajlove..."
docker-compose down -v --remove-orphans
rm -rf .serverless

if [ ! -d "node_modules" ]; then
    echo "📦 Instaliram Node.js pakete..."
    npm install
fi

echo "Podižem LocalStack (Docker)..."
docker-compose up -d

echo "Čekam da LocalStack servisi postanu dostupni..."
for i in {1..30}; do
    if curl -s http://localhost:4566/_localstack/health | grep -q '"cloudformation": "available"'; then
        echo "LocalStack je spreman!"
        break
    fi
    echo "..."
    sleep 2
done

echo "Deploy-ujem infrastrukturu na LocalStack..."
npx sls deploy --stage local

echo "Skelet je podignut i spreman za rad!"
