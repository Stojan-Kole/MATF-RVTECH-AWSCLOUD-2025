# MATF-RVTECH-AWSCLOUD-2025

Ovaj repozitorijum sadrži projekat za kurs Cloud tehnologije na MATF-u. Projekat predstavlja serverless aplikaciju za mapu električnih punjača izgrađenu na AWS platformi.

## Plan i Faze Projekta (Inicijalna verzija)

### 1. Git Flow i Organizacija
- Korišćenje Git Flow metodologije (`main`, `develop`, `feature` grane).
- Struktura foldera:
  - `/infra` - Infrastructure as Code (serverless/CloudFormation).
  - `/backend` - AWS Lambda funkcije (Python).
  - `/frontend` - Web aplikacija (HTML/JS/Other).

### 2. Baza Podataka (Amazon DynamoDB)
- Kreiranje NoSQL tabele `Chargers`.
- Atributi(v1): `ChargerId` (PK), `Latitude`, `Longitude`, `Status`, `Type`.

### 3. Serverless Backend (AWS Lambda & IAM)
- Razvoj funkcija.
- `get_chargers`: Dohvatanje svih dostupnih punjača.
- `update_status`: Promena stanja punjača (slobodno/zauzeto).

### 4. API Sloj (Amazon API Gateway)
- Ekspozicija Lambda funkcija putem REST API-ja.
- Konfiguracija CORS-a za komunikaciju sa frontendom.

### 5. Frontend i Hosting (Amazon S3)
- Vizuelni prikaz punjača na mapi koristeći externe alate.
- Hosting statičkog sajta na S3 bucket-u.

### 6. Infrastruktura kao Kod 
- Automatizovano podizanje celokupne AWS infrastrukture.

## Rokovi
- **Predaja projekta:** 06.02.2026.
- **Odbrana:** 06.02.2026.

## Autori
- Vuk Vujasinović
- Uroš Ivetić
- Stojan Kostić
