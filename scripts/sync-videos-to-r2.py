#!/usr/bin/env python3
"""
Video Sync to Cloudflare R2
===========================

Syncs video files from videos-to-upload/ folder to Cloudflare R2 bucket.
Updates the manifest incrementally (doesn't regenerate from scratch).

Usage: python scripts/sync-videos-to-r2.py [--dry-run] [--force]

Based on the music sync script pattern.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional

try:
    import boto3
    from botocore.exceptions import ClientError
    from tqdm import tqdm
except ImportError as e:
    print("❌ Missing required dependencies:")
    print("   pip install boto3 tqdm")
    print(f"   Error: {e}")
    sys.exit(1)

# Cloudflare R2 Configuration
R2_CONFIG = {
    'account_id': '85eadfbdf07c02e77aa5dc3b46beb0f9',
    'access_key_id': '655dc0505696e129391b3a2756dc902a',
    'secret_access_key': '789522e4838381732bdc6f51d316f33d3cc97a0bbf8cb8118f8bdb55d4a88365',
    'bucket_name': 'sww-videos',
    'public_url': 'https://pub-56b43531787b4783b546dd45f31651a7.r2.dev',
    'endpoint_url': 'https://85eadfbdf07c02e77aa5dc3b46beb0f9.r2.cloudflarestorage.com'
}

# Console colors
class Colors:
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_color(text: str, color: str = ''):
    print(f"{color}{text}{Colors.END}")

def format_size(size_bytes: int) -> str:
    """Format bytes to human readable"""
    if size_bytes == 0:
        return "0B"
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f}{unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f}TB"

def get_s3_client():
    """Create S3 client for Cloudflare R2"""
    try:
        session = boto3.Session(
            aws_access_key_id=R2_CONFIG['access_key_id'],
            aws_secret_access_key=R2_CONFIG['secret_access_key']
        )
        return session.client(
            's3',
            endpoint_url=R2_CONFIG['endpoint_url'],
            region_name='auto'
        )
    except Exception as e:
        print_color(f"❌ Error creating S3 client: {e}", Colors.RED)
        return None

def scan_local_videos(folder: Path) -> Dict[str, int]:
    """Scan local folder for video files, return {filename: size}"""
    videos = {}
    extensions = {'.mp4', '.mov', '.webm', '.m4v'}
    
    for file_path in folder.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in extensions:
            videos[file_path.name] = file_path.stat().st_size
    
    return videos

def list_r2_videos(s3_client, bucket: str) -> Dict[str, int]:
    """List all videos in R2 bucket, return {filename: size}"""
    videos = {}
    
    try:
        paginator = s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=bucket):
            if 'Contents' in page:
                for obj in page['Contents']:
                    key = obj['Key']
                    # Only video files
                    if key.endswith(('.mp4', '.mov', '.webm', '.m4v')):
                        videos[key] = obj.get('Size', 0)
    except Exception as e:
        print_color(f"❌ Error listing R2 bucket: {e}", Colors.RED)
    
    return videos

def compare_files(local: Dict[str, int], remote: Dict[str, int]) -> Tuple[List, List]:
    """
    Compare local vs remote files.
    Returns: (files_to_upload, files_already_synced)
    """
    to_upload = []
    already_synced = []
    
    for filename, local_size in local.items():
        if filename not in remote:
            # New file
            to_upload.append((filename, local_size))
        elif local_size != remote[filename]:
            # Size changed - re-upload
            to_upload.append((filename, local_size))
        else:
            # Already synced
            already_synced.append(filename)
    
    return to_upload, already_synced

def upload_file(s3_client, bucket: str, local_path: Path, key: str, file_size: int) -> bool:
    """Upload a file to R2 with progress bar"""
    try:
        with tqdm(total=file_size, unit='B', unit_scale=True, desc=key, leave=True) as pbar:
            def callback(bytes_transferred):
                pbar.update(bytes_transferred)
            
            s3_client.upload_file(
                str(local_path),
                bucket,
                key,
                Callback=callback
            )
        return True
    except Exception as e:
        print_color(f"❌ Error uploading {key}: {e}", Colors.RED)
        return False

def load_manifest(manifest_path: Path) -> Dict:
    """Load existing manifest"""
    try:
        with open(manifest_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print_color(f"❌ Error loading manifest: {e}", Colors.RED)
        return None

def update_manifest(manifest: Dict, uploaded_files: List[str], public_url: str) -> Dict:
    """Add newly uploaded files to manifest"""
    for filename in uploaded_files:
        # Check if already exists
        if any(v['key'] == filename for v in manifest.get('videos', [])):
            print_color(f"  Already in manifest: {filename}", Colors.YELLOW)
            continue
        
        # Determine if intro video (doesn't start with sww-)
        is_intro = not filename.startswith('sww-')
        entity_id = filename.rsplit('.', 1)[0] if is_intro else None
        ext = filename.split('.')[-1].lower()
        content_type = 'video/quicktime' if ext == 'mov' else 'video/mp4'
        
        entry = {
            'key': filename,
            'url': f"{public_url}/{filename}",
            'contentType': content_type
        }
        
        if is_intro:
            entry['isIntro'] = True
            entry['entityId'] = entity_id
            # Insert intro videos near the beginning (after other intros)
            insert_idx = 0
            for i, v in enumerate(manifest['videos']):
                if v.get('isIntro'):
                    insert_idx = i + 1
                else:
                    break
            manifest['videos'].insert(insert_idx, entry)
            print_color(f"  ✅ Added intro: {filename} (entity: {entity_id})", Colors.GREEN)
        else:
            # Append background videos at end
            manifest['videos'].append(entry)
            print_color(f"  ✅ Added background: {filename}", Colors.GREEN)
    
    # Update metadata
    manifest['totalVideos'] = len(manifest['videos'])
    manifest['generated'] = datetime.utcnow().isoformat() + 'Z'
    
    return manifest

def save_manifest(manifest: Dict, manifest_path: Path):
    """Save manifest to file"""
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

def upload_manifest_to_r2(s3_client, bucket: str, manifest_path: Path) -> bool:
    """Upload manifest to R2"""
    try:
        s3_client.upload_file(
            str(manifest_path),
            bucket,
            'video-manifest.json',
            ExtraArgs={'ContentType': 'application/json'}
        )
        return True
    except Exception as e:
        print_color(f"❌ Error uploading manifest: {e}", Colors.RED)
        return False

def main():
    # Parse arguments
    dry_run = '--dry-run' in sys.argv
    force = '--force' in sys.argv
    
    # Paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    videos_folder = project_root / 'videos-to-upload'
    manifest_path = project_root / 'public' / 'r2-video-manifest.json'
    manifest_cf_path = project_root / 'public' / 'cloudflare' / 'video-manifest.json'
    
    print_color("\n═══════════════════════════════════════════════════════════════", Colors.CYAN)
    print_color("            Cloudflare R2 Video Sync (Python)                   ", Colors.CYAN + Colors.BOLD)
    print_color("═══════════════════════════════════════════════════════════════", Colors.CYAN)
    print_color(f"Source:     {videos_folder}", Colors.GREEN)
    print_color(f"Bucket:     {R2_CONFIG['bucket_name']}", Colors.GREEN)
    print_color(f"Public URL: {R2_CONFIG['public_url']}", Colors.GREEN)
    
    if dry_run:
        print_color("MODE: DRY RUN (no changes will be made)", Colors.YELLOW)
    if force:
        print_color("MODE: FORCE (re-upload all files)", Colors.YELLOW)
    
    # Check videos folder exists
    if not videos_folder.exists():
        print_color(f"\n❌ Videos folder not found: {videos_folder}", Colors.RED)
        return 1
    
    # Scan local videos
    print_color("\n📁 Scanning local videos...", Colors.CYAN)
    local_videos = scan_local_videos(videos_folder)
    print_color(f"   Found {len(local_videos)} video(s) locally", Colors.GREEN)
    
    if not local_videos:
        print_color("   No videos to sync. Add videos to videos-to-upload/ folder.", Colors.YELLOW)
        return 0
    
    # Connect to R2
    print_color("\n🔧 Connecting to Cloudflare R2...", Colors.CYAN)
    s3_client = get_s3_client()
    if not s3_client:
        return 1
    print_color("   ✅ Connected", Colors.GREEN)
    
    # List R2 videos
    print_color("\n📥 Scanning R2 bucket...", Colors.CYAN)
    remote_videos = list_r2_videos(s3_client, R2_CONFIG['bucket_name'])
    print_color(f"   Found {len(remote_videos)} video(s) in R2", Colors.GREEN)
    
    # Compare
    if force:
        to_upload = [(f, s) for f, s in local_videos.items()]
        already_synced = []
    else:
        to_upload, already_synced = compare_files(local_videos, remote_videos)
    
    print_color(f"\n═══ Analysis ═══", Colors.CYAN)
    print_color(f"   To upload: {len(to_upload)}", Colors.GREEN if to_upload else Colors.YELLOW)
    print_color(f"   Already synced: {len(already_synced)}", Colors.GREEN)
    
    if not to_upload:
        print_color("\n✅ All videos already synced!", Colors.GREEN + Colors.BOLD)
        return 0
    
    # Show what will be uploaded
    total_size = sum(size for _, size in to_upload)
    print_color(f"\n📤 Files to upload ({format_size(total_size)}):", Colors.CYAN)
    for filename, size in to_upload:
        is_intro = not filename.startswith('sww-')
        marker = "🎬" if is_intro else "🎥"
        print_color(f"   {marker} {filename} ({format_size(size)})", Colors.GREEN)
    
    if dry_run:
        print_color("\n🔍 DRY RUN - No files uploaded", Colors.YELLOW)
        return 0
    
    # Upload files
    print_color(f"\n═══ Uploading {len(to_upload)} files ═══", Colors.CYAN + Colors.BOLD)
    
    uploaded = []
    failed = []
    
    for filename, size in to_upload:
        local_path = videos_folder / filename
        if upload_file(s3_client, R2_CONFIG['bucket_name'], local_path, filename, size):
            uploaded.append(filename)
        else:
            failed.append(filename)
    
    print_color(f"\n   ✅ Uploaded: {len(uploaded)}", Colors.GREEN)
    if failed:
        print_color(f"   ❌ Failed: {len(failed)}", Colors.RED)
        for f in failed:
            print_color(f"      - {f}", Colors.RED)
    
    # Update manifest
    if uploaded:
        print_color(f"\n═══ Updating Manifest ═══", Colors.CYAN + Colors.BOLD)
        
        manifest = load_manifest(manifest_path)
        if not manifest:
            print_color("❌ Could not load manifest", Colors.RED)
            return 1
        
        print_color(f"   Loaded manifest with {manifest.get('totalVideos', 0)} videos", Colors.GREEN)
        
        manifest = update_manifest(manifest, uploaded, R2_CONFIG['public_url'])
        
        # Save locally
        save_manifest(manifest, manifest_path)
        print_color(f"   ✅ Saved: {manifest_path}", Colors.GREEN)
        
        # Also save to cloudflare folder
        manifest_cf_path.parent.mkdir(parents=True, exist_ok=True)
        save_manifest(manifest, manifest_cf_path)
        print_color(f"   ✅ Saved: {manifest_cf_path}", Colors.GREEN)
        
        # Upload to R2
        print_color("\n📤 Uploading manifest to R2...", Colors.CYAN)
        if upload_manifest_to_r2(s3_client, R2_CONFIG['bucket_name'], manifest_path):
            print_color("   ✅ Manifest uploaded to R2", Colors.GREEN)
        else:
            print_color("   ❌ Failed to upload manifest to R2", Colors.RED)
        
        print_color(f"\n   Total videos in manifest: {manifest['totalVideos']}", Colors.GREEN)
    
    # Summary
    print_color("\n═══════════════════════════════════════════════════════════════", Colors.CYAN)
    print_color("            ✅ Sync Complete!                                   ", Colors.GREEN + Colors.BOLD)
    print_color("═══════════════════════════════════════════════════════════════", Colors.CYAN)
    print_color(f"   Uploaded: {len(uploaded)} videos", Colors.GREEN)
    print_color(f"   Manifest: {R2_CONFIG['public_url']}/video-manifest.json", Colors.GREEN)
    
    if uploaded:
        print_color("\n⚠️  Don't forget to:", Colors.YELLOW)
        print_color("   git add -A && git commit -m 'Add new intro videos' && git push", Colors.YELLOW)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

