# ID Card Generator

A MERN stack web application for generating customized ID cards and images from user-uploaded templates and Excel datasets.

---

## 🚀 Project Flow

1. **Upload Template**
   - User uploads a PNG/JPG template image.
   - Image is stored in MongoDB GridFS.
   - Template metadata is saved in the database.

2. **Define Fields & Mapping**
   - User uploads an Excel sheet (CSV/XLSX).
   - Columns are auto-detected and mapped to fields on the template.
   - User arranges fields visually on the template image.
   - Field layout and mapping are saved.

3. **Preview & Generate**
   - User previews a generated image using sample data from the Excel sheet.
   - User can generate a batch of images as a single PDF for download.

---

## 🛠️ API Endpoints

### Templates

- **POST /api/templates**
  - Upload a template image.
  - **Payload:** `multipart/form-data` with `file`
  - **Response:** `{ _id, name, image: { url }, fields, mapping }`

- **GET /api/templates**
  - List all templates.
  - **Response:** `[{ _id, name, image, ... }]`

- **GET /api/templates/:id**
  - Get template details.
  - **Response:** `{ _id, name, image, fields, mapping }`

- **PUT /api/templates/:id/layout**
  - Update fields and mapping.
  - **Payload:** `{ fields: [...], mapping: { fieldId: columnName } }`
  - **Response:** Updated template object

### Datasets

- **POST /api/datasets**
  - Upload an Excel/CSV file.
  - **Payload:** `multipart/form-data` with `file`
  - **Response:** `{ _id, headers, rowCount }`

- **GET /api/datasets/:id**
  - Get dataset details and sample rows.
  - **Response:** `{ _id, name, headers, rowCount, sampleRows }`

### Generate

- **POST /api/generate/preview**
  - Generate a preview image for a single record.
  - **Payload:** `{ templateId, record }`
  - **Response:** `{ previewUrl }` (base64 image)

- **POST /api/generate/batch**
  - Generate a PDF for all records in a dataset.
  - **Payload:** `{ templateId, datasetId, range? }`
  - **Response:** `{ pdfUrl, count }`

### Files

- **GET /files/:bucket/:id**
  - Download a file (template image, etc.) from GridFS.

---

## 🏗️ Project Structure

```
ID_Generator/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── config/
│   │   ├── models/
│   │   ├── routes/
│   │   └── utils/
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── package.json
│   └── .env.example
└── uploads/
```

---

## 🏁 How to Start

### 1. Backend

```bash
cd backend
cp .env.example .env   # Edit .env with your MongoDB URI
npm install
npm run dev            # Starts server on http://localhost:5050
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env   # Edit .env if needed (API base URL)
npm install
npm run dev            # Starts frontend on http://localhost:5173
```

---

## 📋 Example API Payloads

### Upload Template

**Request:**
- `POST /api/templates`
- FormData: `file=<image>`

**Response:**
```json
{
  "_id": "...",
  "name": "Template Name",
  "image": { "url": "/files/templates/<id>" },
  "fields": [],
  "mapping": {}
}
```

### Upload Dataset

**Request:**
- `POST /api/datasets`
- FormData: `file=<excel/csv>`

**Response:**
```json
{
  "_id": "...",
  "headers": ["Name", "ID", "Dept"],
  "rowCount": 10
}
```

### Generate Preview

**Request:**
- `POST /api/generate/preview`
- JSON: `{ "templateId": "...", "record": { "Name": "Alice", ... } }`

**Response:**
```json
{
  "previewUrl": "data:image/png;base64,..."
}
```

### Generate Batch PDF

**Request:**
- `POST /api/generate/batch`
- JSON: `{ "templateId": "...", "datasetId": "..." }`

**Response:**
```json
{
  "pdfUrl": "/uploads/outputs/batch-<timestamp>.pdf",
  "count": 10
}
```

---

## 📖 Notes
- All environment variables are configured via `.env` files in each folder.
- `uploads/` stores generated files and previews (ignored by git).
- For development, backend runs on port 5050, frontend on 5173 by default.

---

## License
MIT
