from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import boto3
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Permitir que el Frontend hable con el Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Conectar con S3 usando las claves temporales del laboratorio
s3_client = boto3.client(
    's3',
    region_name=os.getenv('AWS_REGION'),
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    aws_session_token=os.getenv('AWS_SESSION_TOKEN')
)
BUCKET_NAME = os.getenv('BUCKET_NAME')

class FileRequest(BaseModel):
    file_name: str
    file_size: int

# SPRINT 1: Endpoint para generar URL firmada
@app.post("/api/upload/presigned-url")
def get_presigned_url(request: FileRequest):
    max_size = 14 * 1024 * 1024 # 14 MB límite para P-12
    if request.file_size > max_size:
        raise HTTPException(status_code=400, detail="El archivo excede los 14 MB.")

    allowed_extensions = ['.docx', '.odt', '.rtf'] # Tipos P-12
    ext = os.path.splitext(request.file_name)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Solo archivos DOCX, ODT o RTF.")

    key = f"uploads/{request.file_name}"
    try:
        presigned_data = s3_client.generate_presigned_post(
            Bucket=BUCKET_NAME, Key=key, ExpiresIn=3600
        )
        return {"presignedUrl": presigned_data, "key": key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# SPRINT 2: Endpoint para listar archivos
@app.get("/api/files")
def list_files():
    try:
        response = s3_client.list_objects_v2(Bucket=BUCKET_NAME, Prefix="uploads/")
        files = []
        if 'Contents' in response:
            for item in response['Contents']:
                if item['Key'] != "uploads/":
                    files.append({
                        "name": item['Key'].replace("uploads/", ""),
                        "size": item['Size'],
                        "key": item['Key']
                    })
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# SPRINT 2: Endpoint para borrar archivos
@app.delete("/api/files/{key:path}")
def delete_file(key: str):
    try:
        s3_client.delete_object(Bucket=BUCKET_NAME, Key=key)
        return {"message": "Borrado con éxito"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))