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
        alert("¡Archivo subido con éxito!")
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

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>☁️ ArchivaCloud</h1>
        <span className="badge"></span>
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
            {/* Un label estilizado que funciona como botón de selección */}
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
                  <button className="btn-delete" onClick={() => handleDelete(file.key)}>
                    🗑️ Borrar
                  </button>
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