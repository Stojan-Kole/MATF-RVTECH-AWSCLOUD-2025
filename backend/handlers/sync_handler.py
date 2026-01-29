import json
import boto3
import os
import urllib3
import time

LOCALSTACK_HOSTNAME = os.environ.get('LOCALSTACK_HOSTNAME')
DYNAMODB_ENDPOINT = f"http://{LOCALSTACK_HOSTNAME}:4566" if LOCALSTACK_HOSTNAME else "http://localhost:4566"

dynamodb = boto3.resource('dynamodb', endpoint_url=DYNAMODB_ENDPOINT, region_name='us-east-1')
table = dynamodb.Table(os.environ['DYNAMODB_TABLE'])
http = urllib3.PoolManager(cert_reqs='CERT_NONE')

def normalize_town(town, postcode):
    if town in ['Belgrad', 'Belgrade', 'Beograd']:
        return 'Belgrade'
    if postcode and str(postcode).startswith('11'):
        return 'Belgrade'
    return town if town else 'Unknown'

def sync_data(event, context):
    print(f"Povezivanje na DynamoDB: {DYNAMODB_ENDPOINT}")
    
    api_key = os.environ.get('OCM_API_KEY')
    ocm_url = os.environ.get('OCM_URL')
    
    params = f"?key={api_key}&countrycode=RS&maxresults=1000&compact=true&verbose=false"
    
    try:
        print("Preuzimanje punjača sa OCM-a...")
        response = http.request('GET', f"{ocm_url}{params}")
        chargers = json.loads(response.data.decode('utf-8'))
        print(f"Preuzeto {len(chargers)} punjača.")

        ttl = int(time.time()) + 2 * 24 * 60 * 60 # TTL 2 dana
        items = []
        current_ids = set()

        for c in chargers:
            addr = c.get('AddressInfo', {})
            town = normalize_town(addr.get('Town'), addr.get('Postcode'))
            c_id = str(c.get('ID'))

            status = c.get('StatusType', {}).get('IsOperational')

            items_status = 'Available' if status else 'Offline'
            print(f"Status za {c_id}: {items_status}")
            
            item = {
                'chargerId': c_id,
                'town': town,
                'title': addr.get('Title'),
                'latitude': str(addr.get('Latitude')),
                'longitude': str(addr.get('Longitude')),
                'status': items_status,
                'ttl': ttl
            }
            items.append(item)
            current_ids.add(c_id)

        with table.batch_writer() as batch:
            for item in items:
                batch.put_item(Item=item)
        
        scan_response = table.scan(ProjectionExpression='chargerId')
        stale_items = [i for i in scan_response.get('Items', []) if i['chargerId'] not in current_ids]
        
        if stale_items:
            with table.batch_writer() as batch:
                for si in stale_items:
                    batch.delete_item(Key={'chargerId': si['chargerId']})

        return {
            "statusCode": 200,
            "headers": { "Access-Control-Allow-Origin": "*" },
            "body": json.dumps({
                "message": "OCM data synced",
                "synced": len(items),
                "deleted": len(stale_items)
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }