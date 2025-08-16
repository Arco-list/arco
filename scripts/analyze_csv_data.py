import requests
import csv
import json
from io import StringIO

# Fetch the CSV data from the provided URL
csv_url = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20DB%20Sheet1-cXdpGJbMBCle2SYCeP1YtYIlkAPSnx.csv"

try:
    response = requests.get(csv_url)
    response.raise_for_status()
    
    # Parse CSV data
    csv_content = StringIO(response.text)
    csv_reader = csv.DictReader(csv_content)
    
    # Initialize data structure to organize the values
    organized_data = {
        "FEATURES": [],
        "FEATURE_CATEGORIES": [],
        "LISTING_TYPES": [],
        "PROJECT_ATTRIBUTES": [],
        "PROFESSIONAL_CATEGORIES": []
    }
    
    # Process each row
    for row in csv_reader:
        # Clean and organize data from each column
        if row.get("FEATURES") and row["FEATURES"].strip():
            feature = row["FEATURES"].strip()
            if feature not in organized_data["FEATURES"]:
                organized_data["FEATURES"].append(feature)
        
        # Handle the unnamed column (Feature Category)
        if row.get("") and row[""].strip():
            category = row[""].strip()
            if category not in organized_data["FEATURE_CATEGORIES"]:
                organized_data["FEATURE_CATEGORIES"].append(category)
        
        if row.get("LISTING TYPES") and row["LISTING TYPES"].strip():
            listing_type = row["LISTING TYPES"].strip()
            if listing_type not in organized_data["LISTING_TYPES"]:
                organized_data["LISTING_TYPES"].append(listing_type)
        
        if row.get("PROJECT ATTRIBUTES") and row["PROJECT ATTRIBUTES"].strip():
            attribute = row["PROJECT ATTRIBUTES"].strip()
            if attribute not in organized_data["PROJECT_ATTRIBUTES"]:
                organized_data["PROJECT_ATTRIBUTES"].append(attribute)
        
        if row.get("PROFESSIONAL CATEGORY") and row["PROFESSIONAL CATEGORY"].strip():
            prof_category = row["PROFESSIONAL CATEGORY"].strip()
            if prof_category not in organized_data["PROFESSIONAL_CATEGORIES"]:
                organized_data["PROFESSIONAL_CATEGORIES"].append(prof_category)
    
    # Print organized data for analysis
    print("=== ARCO DATABASE ANALYSIS ===\n")
    
    for category, items in organized_data.items():
        print(f"{category.replace('_', ' ')} ({len(items)} items):")
        for item in sorted(items):
            print(f"  - {item}")
        print()
    
    # Create JavaScript/TypeScript compatible data structure
    js_data = {
        "features": organized_data["FEATURES"],
        "featureCategories": organized_data["FEATURE_CATEGORIES"],
        "listingTypes": organized_data["LISTING_TYPES"],
        "projectAttributes": organized_data["PROJECT_ATTRIBUTES"],
        "professionalCategories": organized_data["PROFESSIONAL_CATEGORIES"]
    }
    
    print("=== JAVASCRIPT DATA STRUCTURE ===")
    print("export const arcoData = " + json.dumps(js_data, indent=2) + ";")
    
except Exception as e:
    print(f"Error fetching or processing CSV data: {e}")
