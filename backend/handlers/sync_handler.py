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
    
    countries = ['RS', 'XK', 'BA']
    
    # Gradovi u Republici Srpskoj (i Brčko) za filtriranje
    rs_towns = [
        'Banja Luka', 'Bijeljina', 'Prijedor', 'Doboj', 'Trebinje', 
        'Zvornik', 'Gradiška', 'Laktaši', 'Istočno Sarajevo', 'Pale', 
        'Foča', 'Višegrad', 'Derventa', 'Modriča', 'Prnjavor',
        'Mrkonjić Grad', 'Bileća', 'Rogatica', 'Sokolac', 'Šipovo', 
        'Čelinac', 'Bratunac', 'Kozarska Dubica', 'Novi Grad', 'Teslić', 
        'Brod', 'Šamac', 'Ugljevik', 'Vlasenica', 'Nevesinje', 'Brčko', 'Brcko', 'Dabrac', 'Jahorina'
    ]
    
    chargers = []
    
    try:
        for country in countries:
            print(f"Preuzimanje punjača sa OCM-a za {country}...")
            params = f"?key={api_key}&countrycode={country}&maxresults=1000&compact=false&verbose=false"
            response = http.request('GET', f"{ocm_url}{params}")
            data = json.loads(response.data.decode('utf-8'))
            
            if country == 'BA':
                filtered_data = []
                for c in data:
                    addr = c.get('AddressInfo', {})
                    state = addr.get('StateOrProvince', '') or ''
                    town = addr.get('Town', '') or ''
                    
                    is_rs_or_brcko = (
                        "srpska" in state.lower() or 
                        any(t.lower() in town.lower() for t in rs_towns)
                    )
                    
                    if is_rs_or_brcko:
                        filtered_data.append(c)
                
                print(f"Filtrirano {len(filtered_data)} punjača za Republiku Srpsku od {len(data)}.")
                chargers.extend(filtered_data)
            else:
                chargers.extend(data)
                
            print(f"Preuzeto (ukupno validnih) {len(data)} punjača za {country}.")
            
        print(f"Ukupno preuzeto {len(chargers)} punjača.")

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