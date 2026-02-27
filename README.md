![Ceo ekran](https://github.com/user-attachments/assets/5e10b048-7db6-498c-9c80-a4c13ea469f6)# MATF-RVTECH-AWSCLOUD-2025

Ovaj repozitorijum sadrži projekat za kurs Cloud tehnologije na MATF-u. Projekat predstavlja serverless aplikaciju za mapu električnih punjača izgrađenu na AWS platformi.

## Izgled aplikacije
![Ceo ekran](https://github.com/user-attachments/assets/6d7287ae-eadf-4f88-825a-7296616d8758)
![Beograd](https://github.com/user-attachments/assets/10e7f550-3017-42fe-bf28-f1a202369726)

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
