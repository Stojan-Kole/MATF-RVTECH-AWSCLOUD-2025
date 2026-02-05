import json
import boto3
import os
from decimal import Decimal

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            # Ako je ceo broj, pretvori u int, ako nije u float
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

LOCALSTACK_HOSTNAME = os.environ.get('LOCALSTACK_HOSTNAME')
DYNAMODB_ENDPOINT = f"http://{LOCALSTACK_HOSTNAME}:4566" if LOCALSTACK_HOSTNAME else "http://localhost:4566"

dynamodb = boto3.resource('dynamodb', endpoint_url=DYNAMODB_ENDPOINT)
table = dynamodb.Table(os.environ['DYNAMODB_TABLE'])

def get_all(event, context):
    try:
        query_params = event.get('queryStringParameters') or {}
        town = query_params.get('town')

        if town:
            print(f"Pretraga po gradu: {town}")
            response = table.query(
                IndexName='TownIndex',
                KeyConditionExpression=boto3.dynamodb.conditions.Key('town').eq(town)
            )
        else:
            print("Vraćanje svih punjača...")
            response = table.scan()

        items = response.get('Items', [])

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps(items, cls=DecimalEncoder)
        }
    except Exception as e:
        print(f"Greška u get_all: {str(e)}")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}