from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import boto3
import os
from dotenv import load_dotenv
import re

load_dotenv()

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.delete("/api/files/{key:path}")
def delete_file(key: str):
    try:
        s3_client.delete_object(Bucket=BUCKET_NAME, Key=key)
        return {"message": "Borrado con éxito"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
class RenameRequest(BaseModel):
    old_key: str
    new_name: str

@app.put("/api/files/rename")
def rename_file(request: RenameRequest):
    
    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '', request.new_name)
    
    
    ext = os.path.splitext(safe_name)[1].lower()
    allowed_extensions = ['.docx', '.odt', '.rtf']
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Extensión no permitida. Solo DOCX, ODT, RTF.")

    new_key = f"uploads/{safe_name}"

    try:
        
        copy_source = {'Bucket': BUCKET_NAME, 'Key': request.old_key}
        s3_client.copy_object(CopySource=copy_source, Bucket=BUCKET_NAME, Key=new_key)
        
        
        s3_client.delete_object(Bucket=BUCKET_NAME, Key=request.old_key)
        
        return {"message": "Archivo renombrado con éxito", "new_key": new_key}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error en AWS al renombrar el archivo")