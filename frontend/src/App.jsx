// frontend/src/App.jsx
import { useState, useEffect } from 'react'
import './App.css' // Importamos los estilos que acabamos de crear

function App() {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)

  const fetchFiles = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/files")
      const data = await res.json()
      setFiles(data)
    } catch (error) {
      console.error("Error cargando archivos:", error)
    }
  }

  useEffect(() => { fetchFiles() }, [])

  const handleUpload = async () => {
    if (!selectedFile) return alert("Selecciona un archivo")

    // --- SEGURIDAD SEC-04 (Frontend) ---
    if (selectedFile.size > 14 * 1024 * 1024) {
      return alert("Error de Seguridad SEC-04: El archivo supera los 14 MB permitidos para P-12.")
    }

    try {
      // 1. Pedir permiso al backend
      const res = await fetch("http://localhost:8000/api/upload/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          file_name: selectedFile.name, 
          file_size: selectedFile.size 
        })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)

      // 2. Subir directo a S3
      const formData = new FormData()
      Object.entries(data.presignedUrl.fields).forEach(([key, value]) => {
        formData.append(key, value)
      })
      formData.append("file", selectedFile)

      const uploadRes = await fetch(data.presignedUrl.url, {
        method: "POST",
        body: formData
      })

      if (uploadRes.ok) {
        // --- NUEVO PASO: Guardar registro en DynamoDB ---
        try {
          await fetch("http://localhost:8000/api/files/log-dynamo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              file_name: selectedFile.name, 
              file_size: selectedFile.size 
            })
          })
          console.log("Registro guardado en DynamoDB")
        } catch (dbError) {
          console.error("Error guardando en la base de datos:", dbError)
        }
        // ------------------------------------------------

        alert("¡Archivo subido con éxito a S3 y registrado en DynamoDB!")
        setSelectedFile(null) // Limpiamos la selección
        fetchFiles()
      }
    } catch (error) {
      alert("Error: " + error.message)
    }
  }

  const handleDelete = async (key) => {
    if(window.confirm("¿Estás seguro de eliminar este archivo?")) {
      await fetch(`http://localhost:8000/api/files/${key}`, { method: "DELETE" })
      fetchFiles()
    }
  }

  const handleRename = async (oldKey, currentName) => {
    const newName = prompt("Escribe el nuevo nombre del archivo (incluye la extensión .docx, .odt o .rtf):", currentName)
    
    if (!newName || newName === currentName) return // Si cancela o no cambia nada, no hacemos nada

    try {
      const res = await fetch("http://localhost:8000/api/files/rename", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_key: oldKey, new_name: newName })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      
      alert("¡Nombre actualizado!")
      fetchFiles() // Recargar la lista
    } catch (error) {
      alert("Error al renombrar: " + error.message)
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>☁️ ArchivaCloud</h1>
        
      </header>
      
      <main>
        {/* Tarjeta de Subida */}
        <div className="card upload-section">
          <h2>Subir Nuevo Documento</h2>
          <p className="restrictions">
            Formatos permitidos: <strong>DOCX, ODT, RTF</strong> | Tamaño Máximo: <strong>14 MB</strong>
          </p>
          
          <div className="file-input-wrapper">
            <input 
              type="file" 
              id="file-upload" 
              className="file-input" 
              onChange={(e) => setSelectedFile(e.target.files[0])} 
            />
            <label htmlFor="file-upload" className="file-label">
              {selectedFile ? `📄 ${selectedFile.name}` : "📁 Seleccionar Archivo"}
            </label>
          </div>
          
          <button 
            className="btn-upload" 
            onClick={handleUpload} 
            disabled={!selectedFile}
          >
            🚀 Subir a la Nube
          </button>
        </div>

        {/* Tarjeta de Lista de Archivos */}
        <div className="card files-section">
          <h2>Mis Archivos en S3</h2>
          
          {(!files || files.length === 0) ? (
            <p className="empty-state">No hay archivos subidos aún.</p>
          ) : (
            <ul className="file-list">
              {Array.isArray(files) && files.map(file => (
                <li key={file.key} className="file-item">
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  
                  <div className="file-actions">
                    <button 
                      className="btn-rename" 
                      onClick={() => handleRename(file.key, file.name)}
                      style={{ backgroundColor: "#f39c12", color: "white", border: "none", padding: "8px 14px", borderRadius: "4px", cursor: "pointer", marginRight: "10px", fontWeight: "bold" }}
                    >
                      ✏️ Renombrar
                    </button>
                    
                    <button className="btn-delete" onClick={() => handleDelete(file.key)}>
                      🗑️ Borrar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

export default App