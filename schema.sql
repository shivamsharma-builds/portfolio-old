CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS site_content (
  id INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  headline VARCHAR(255) NOT NULL,
  intro TEXT,
  about_title VARCHAR(255),
  about_text LONGTEXT,
  what_i_do LONGTEXT,
  goals LONGTEXT,
  email VARCHAR(255),
  github VARCHAR(500),
  location VARCHAR(255),
  profile_image VARCHAR(500),
  resume_file VARCHAR(500),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS skills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(100) NOT NULL DEFAULT 'Other',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  icon_file VARCHAR(500),
  icon_url VARCHAR(1000),
  sort_order INT DEFAULT 0
);


-- Normalize common existing skill names into useful public categories.
UPDATE skills
SET category = CASE
  WHEN LOWER(title) IN ('c','c++','cpp','java','python','javascript','typescript','php','go','rust','kotlin','swift') THEN 'Languages'
  WHEN LOWER(title) LIKE '%html%' OR LOWER(title) LIKE '%css%' OR LOWER(title) LIKE '%web%' THEN 'Web Development'
  WHEN LOWER(title) LIKE '%react%' OR LOWER(title) LIKE '%node%' OR LOWER(title) LIKE '%express%' OR LOWER(title) LIKE '%next%' OR LOWER(title) LIKE '%django%' OR LOWER(title) LIKE '%spring%' OR LOWER(title) LIKE '%angular%' OR LOWER(title) LIKE '%vue%' THEN 'Frameworks'
  WHEN LOWER(title) LIKE '%tensorflow%' OR LOWER(title) LIKE '%pytorch%' OR LOWER(title) LIKE '%scikit%' OR LOWER(title) LIKE '%keras%' OR LOWER(title) LIKE '%machine learning%' OR LOWER(title) LIKE '%deep learning%' OR LOWER(title) LIKE '%artificial intelligence%' THEN 'AI & ML'
  WHEN LOWER(title) LIKE '%sql%' OR LOWER(title) LIKE '%mysql%' OR LOWER(title) LIKE '%postgres%' OR LOWER(title) LIKE '%mongodb%' OR LOWER(title) LIKE '%database%' THEN 'Databases'
  WHEN LOWER(title) LIKE '%git%' OR LOWER(title) LIKE '%docker%' OR LOWER(title) LIKE '%linux%' OR LOWER(title) LIKE '%aws%' OR LOWER(title) LIKE '%netlify%' OR LOWER(title) LIKE '%postman%' THEN 'Tools'
  WHEN LOWER(title) LIKE '%numpy%' OR LOWER(title) LIKE '%pandas%' OR LOWER(title) LIKE '%matplotlib%' OR LOWER(title) LIKE '%library%' THEN 'Libraries'
  ELSE COALESCE(NULLIF(TRIM(category), ''), 'Other')
END
WHERE category = 'Other' OR category IS NULL OR TRIM(category) = '';
CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  icon_file VARCHAR(500),
  icon_url VARCHAR(1000),
  image_url VARCHAR(1000),
  project_url VARCHAR(1000),
  github_url VARCHAR(1000),
  project_file VARCHAR(500),
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS experiences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  company VARCHAR(255),
  logo_image VARCHAR(500),
  description LONGTEXT,
  start_date VARCHAR(100),
  end_date VARCHAR(100),
  duration VARCHAR(150),
  location VARCHAR(255),
  url VARCHAR(1000),
  offer_letter_url VARCHAR(1000),
  offer_letter_file VARCHAR(1000),
  sort_order INT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS certificates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  issuer VARCHAR(255),
  description LONGTEXT,
  issue_date VARCHAR(100),
  credential_id VARCHAR(255),
  credential_url VARCHAR(1000),
  certificate_image VARCHAR(500),
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS education (
  id INT AUTO_INCREMENT PRIMARY KEY,
  institution VARCHAR(255),
  logo_image VARCHAR(500),
  discipline VARCHAR(255),
  domain_name VARCHAR(255),
  branch VARCHAR(255),
  stream VARCHAR(255),
  start_date VARCHAR(100),
  end_date VARCHAR(100),
  duration VARCHAR(150),
  description LONGTEXT,
  url VARCHAR(1000),
  sort_order INT DEFAULT 0
);
