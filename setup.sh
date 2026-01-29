#!/bin/bash


echo "Čistim stare kontejnere i privremene fajlove..."
docker-compose down -v --remove-orphans
rm -rf .serverless

if [ ! -d "node_modules" ]; then
    echo "Instaliram Node.js pakete..."
    npm install
fi


docker-compose up -d

for i in {1..30}; do
    if curl -s http://localhost:4566/_localstack/health | grep -q '"cloudformation": "available"'; then
        echo "LocalStack je spreman!"
        break
    fi
    echo "..."
    sleep 3
done

npx sls deploy --stage local

API_ID=$(awslocal apigateway get-rest-apis --query "items[?name=='local-matf-ev-charger-app'].id" --output text)

if [ -z "$API_ID" ] || [ "$API_ID" == "None" ]; then
    echo "UPOZORENJE: Nisam uspeo da pronađem API ID. Frontend možda neće raditi ispravno."
else
    echo "Pronađen API ID: $API_ID"
    API_URL="http://localhost:4566/restapis/$API_ID/local/_user_request_/chargers"
    
    cat > frontend/js/config.js <<EOF
const API_CONFIG = {
    apiUrl: "$API_URL"
};
EOF
    echo "Frontend konfigurisan sa URL-om: $API_URL"
    
    echo "Sinhronizujem podatke (prvo punjenje)..."
    awslocal lambda invoke --function-name matf-ev-charger-app-local-SyncOCM response.json > /dev/null 2>&1
    rm -f response.json

    npm run deploy-frontend

    WEBSITE_URL="http://local-matf-ev-charger-frontend.s3-website.localhost:4566"
    
    echo "----------------------------------------------------"
    echo "Aplikacija je spremna!"
    echo "S3 Website URL: $WEBSITE_URL"
    echo "API Endpoint: $API_URL"
    echo "----------------------------------------------------"
fi

