import pypandoc

# Project documentation in markdown format
project_doc = """
# 📌 Project Documentation: Template-based Image Generation Platform

## 1. Overview
This project is a **MERN stack web application** that allows users to:
- Upload their own template images (PNG/JPG).
- Define editable areas (mapping regions like text/image placeholders).
- Generate customized images by replacing placeholders with user data (text, images, etc.).

The goal is to create a **dynamic template engine** where users can generate new creatives from an uploaded base template.

---

## 2. Tech Stack
- **Frontend:** React.js, TailwindCSS, Redux (for state management)
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (store templates, mapping data, user-generated images)
- **Image Processing:** Sharp (for image manipulation), Fabric.js/Canvas API (for defining mappings)
- **Authentication:** JWT-based auth (user login/signup)
- **Hosting:** Vercel/Netlify (frontend), AWS/Render (backend), MongoDB Atlas (database)

---

## 3. User Flow (High Level)
1. **User Uploads Template**
   - User uploads a PNG/JPG.
   - The system saves it in storage (AWS S3 or local uploads).
   - The template is stored in MongoDB with metadata.

2. **Define Mapping (Admin/Creator)**
   - User defines **editable zones** (text fields, image placeholders).
   - Each mapping is stored in DB with coordinates (x, y, width, height, type).

3. **Template Usage**
   - Another user selects a template.
   - User enters custom text/images in the mapped fields.
   - System generates final image using Sharp/Canvas.

4. **Download / Share**
   - User can download the final image as PNG/JPG.
   - Optionally, share via a link (stored in DB).

---

## 4. Database Schema (MongoDB)
### `users` Collection
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "password": "hashed_string",
  "role": "admin|user",
  "createdAt": "date"
}
