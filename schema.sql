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
  title VARCHAR(255) NOT NULL,
  description TEXT,
  icon_file VARCHAR(500),
  sort_order INT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  icon_file VARCHAR(500),
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
