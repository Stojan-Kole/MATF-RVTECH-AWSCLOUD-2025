#!/bin/bash

if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose --version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "Greška: Ni 'docker compose' ni 'docker-compose' nisu pronađeni. Molimo instalirajte Docker Compose."
    exit 1
fi

echo "Koristim: $DOCKER_COMPOSE"

echo "Čistim stare kontejnere i privremene fajlove..."
$DOCKER_COMPOSE down -v --remove-orphans
rm -rf .serverless

if [ ! -d "node_modules" ]; then
    echo "Instaliram Node.js pakete..."
    npm install
fi


$DOCKER_COMPOSE up -d

for i in {1..30}; do
    if curl -s http://localhost:4566/_localstack/health | grep -q '"cloudformation": "available"'; then
        echo "LocalStack je spreman!"
        break
    fi
    echo "..."
    sleep 3
done


# Function to deploy frontend to S3
function deploy_frontend_to_s3() {
    local frontend_dir="$1"
    local bucket_name="$2"
    
    # Try awslocal first
    if command -v awslocal &> /dev/null; then
        AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1 \
            awslocal s3 sync "$frontend_dir" "s3://$bucket_name" --delete
        return $?
    # Try aws CLI with endpoint URL
    elif command -v aws &> /dev/null; then
        AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1 \
            aws --endpoint-url=http://localhost:4566 s3 sync "$frontend_dir" "s3://$bucket_name" --delete
        return $?
    # Fallback: use Docker with AWS CLI image
    elif command -v docker &> /dev/null; then
        echo "Koristim Docker za upload frontend fajlova..."
        # Detect if running on macOS (host.docker.internal) or Linux (host network)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS: use host.docker.internal to reach LocalStack
            docker run --rm \
                -v "$(pwd)/$frontend_dir:/frontend" \
                -e AWS_ACCESS_KEY_ID=test \
                -e AWS_SECRET_ACCESS_KEY=test \
                -e AWS_REGION=us-east-1 \
                amazon/aws-cli:latest \
                s3 sync /frontend "s3://$bucket_name" \
                --endpoint-url=http://host.docker.internal:4566 \
                --delete
        else
            # Linux: use host network
            docker run --rm \
                -v "$(pwd)/$frontend_dir:/frontend" \
                -e AWS_ACCESS_KEY_ID=test \
                -e AWS_SECRET_ACCESS_KEY=test \
                -e AWS_REGION=us-east-1 \
                --network host \
                amazon/aws-cli:latest \
                s3 sync /frontend "s3://$bucket_name" \
                --endpoint-url=http://localhost:4566 \
                --delete
        fi
        return $?
    else
        echo "Greška: Nisu pronađeni 'awslocal', 'aws' CLI ni Docker. Ne mogu da uploadujem frontend."
        return 1
    fi
}

# Function to get API ID safely
function get_api_id() {
    local api_id=""
    
    # Try awslocal first
    if command -v awslocal &> /dev/null; then
        api_id=$(awslocal apigateway get-rest-apis --query "items[?name=='local-matf-ev-charger-app'].id" --output text 2>/dev/null)
    # Try aws CLI with endpoint URL
    elif command -v aws &> /dev/null; then
        api_id=$(aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis --query "items[?name=='local-matf-ev-charger-app'].id" --output text 2>/dev/null)
    fi
    
    # If still empty, use curl to query LocalStack API Gateway directly
    if [ -z "$api_id" ] || [ "$api_id" == "None" ]; then
        # Try using jq if available for better JSON parsing
        if command -v jq &> /dev/null; then
            api_id=$(curl -s http://localhost:4566/restapis 2>/dev/null | jq -r '.items[0].id' 2>/dev/null)
        else
            # Fallback: extract ID using grep/sed
            api_id=$(curl -s http://localhost:4566/restapis 2>/dev/null | grep -oE '"id"\s*:\s*"[^"]+"' | head -1 | sed -E 's/"id"\s*:\s*"([^"]+)"/\1/')
        fi
    fi
    
    echo "$api_id"
}

# echo "Proveravam awslocal..."
# if ! command -v awslocal &> /dev/null && ! command -v aws &> /dev/null; then
#   echo "Greška: Nisu pronađeni 'awslocal' ni 'aws' CLI. Molimo instalirajte AWS CLI."
#   exit 1
# fi

# Deploy and capture output
DEPLOY_OUTPUT=$(npx sls deploy --stage local 2>&1)

# Extract API ID from serverless output (endpoint URL)
API_ID=$(echo "$DEPLOY_OUTPUT" | grep -o 'endpoint: http://localhost:4566/restapis/[^/]*' | sed 's|.*/restapis/||' | head -1)

# If not found in output, try the function
if [ -z "$API_ID" ]; then
    # Wait a moment for API Gateway to be ready
    sleep 2
    API_ID=$(get_api_id)
fi

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
    if command -v awslocal &> /dev/null; then
        awslocal lambda invoke --function-name matf-ev-charger-app-local-SyncOCM response.json > /dev/null 2>&1
    elif command -v aws &> /dev/null; then
        aws --endpoint-url=http://localhost:4566 lambda invoke --function-name matf-ev-charger-app-local-SyncOCM response.json > /dev/null 2>&1
    fi
    rm -f response.json

    echo "Čekam da se S3 bucket kreira..."
    sleep 3
    
    echo "Uploadujem frontend fajlove..."
    if deploy_frontend_to_s3 "frontend" "local-matf-ev-charger-frontend"; then
        echo "Frontend uspešno uploadovan!"
    else
        echo "UPOZORENJE: Neuspešan upload frontend fajlova."
        echo "Pokušajte ručno sa:"
        echo "  awslocal s3 sync frontend s3://local-matf-ev-charger-frontend"
        echo "ili"
        echo "  aws --endpoint-url=http://localhost:4566 s3 sync frontend s3://local-matf-ev-charger-frontend"
    fi

    WEBSITE_URL="http://local-matf-ev-charger-frontend.s3-website.localhost:4566"
    
    echo "----------------------------------------------------"
    echo "Aplikacija je spremna!"
    echo "S3 Website URL: $WEBSITE_URL"
    echo "API Endpoint: $API_URL"
    echo "----------------------------------------------------"
fi


