#!/usr/bin/env python3
"""
Set CORS configuration on R2 bucket to allow highermind.ai to fetch videos
"""

import os
import boto3
from botocore.config import Config

# R2 Configuration from environment
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = "sww-videos"

def main():
    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY]):
        print("❌ Missing R2 credentials in environment variables")
        print("   Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY")
        return

    print(f"🔧 Setting CORS configuration for bucket: {R2_BUCKET_NAME}")
    
    # Create S3 client for R2
    s3 = boto3.client(
        's3',
        endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4')
    )
    
    # CORS configuration
    cors_configuration = {
        'CORSRules': [
            {
                'AllowedHeaders': ['*'],
                'AllowedMethods': ['GET', 'HEAD'],
                'AllowedOrigins': [
                    'https://highermind.ai',
                    'https://www.highermind.ai',
                    'https://saywhatwant.app',
                    'https://www.saywhatwant.app',
                    'http://localhost:3000',
                    'http://localhost:3001',
                ],
                'ExposeHeaders': ['ETag', 'Content-Length', 'Content-Type'],
                'MaxAgeSeconds': 86400  # 24 hours
            }
        ]
    }
    
    try:
        s3.put_bucket_cors(
            Bucket=R2_BUCKET_NAME,
            CORSConfiguration=cors_configuration
        )
        print("✅ CORS configuration set successfully!")
        print("\n   Allowed origins:")
        for origin in cors_configuration['CORSRules'][0]['AllowedOrigins']:
            print(f"   - {origin}")
    except Exception as e:
        print(f"❌ Failed to set CORS: {e}")

if __name__ == "__main__":
    main()

