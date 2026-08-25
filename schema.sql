CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_content (
  id TINYINT UNSIGNED PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  headline VARCHAR(255) NOT NULL,
  subheadline VARCHAR(255) NOT NULL,
  intro TEXT NOT NULL,
  about_title VARCHAR(255) NOT NULL,
  about_text LONGTEXT NOT NULL,
  what_i_do LONGTEXT NOT NULL,
  goals LONGTEXT NOT NULL,
  email VARCHAR(255) NOT NULL,
  github VARCHAR(255) NOT NULL,
  location VARCHAR(120) NOT NULL,
  resume_url VARCHAR(500) NOT NULL,
  profile_image_url VARCHAR(500) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skills (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  icon_url VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  project_url VARCHAR(500) NOT NULL,
  github_url VARCHAR(500) DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO site_content (
  id, full_name, headline, subheadline, intro, about_title, about_text,
  what_i_do, goals, email, github, location, resume_url, profile_image_url
) VALUES (
  1,
  'Shivam Sharma',
  'Web Developer & C++ Programmer',
  'A Passionate Web Developer',
  'I specialize in crafting modern, responsive websites and solving problems with efficient code. My approach blends clean design with seamless functionality.',
  'About Me 🚀',
  'Welcome to my portfolio! I’m a B.Tech CSE student passionate about creating interactive web experiences. With expertise in HTML, CSS, JavaScript, and C++, I transform ideas into functional, visually appealing projects. I enjoy crafting clean, efficient code for both sleek front-end interfaces and complex C++ solutions.\n\nDriven by curiosity, I’m constantly learning and tackling challenges that enhance my skills.',
  '💡 Front-End Development: Building responsive websites with HTML, CSS, and JavaScript.\n\n⚙️ C++ Programming: Writing optimized algorithms and solving complex problems.\n\n🚀 Continuous Learning: Exploring new technologies and best practices.',
  '💡 Master Full-Stack Development\n\n⚙️ Contribute to Open-Source\n\n🚀 Build Scalable Web Applications',
  'shivamsharma123jmt@gmail.com',
  'https://github.com/shivamsharma-builds',
  'India',
  './public/resume/resume.pdf',
  './src/assets/images/profile.jpg'
) ON DUPLICATE KEY UPDATE id=id;

INSERT INTO skills (title, description, icon_url, sort_order)
SELECT 'HTML Developer', 'Crafting semantic, accessible websites with HTML5 for optimal performance.', './public/icons/html.png', 1
WHERE NOT EXISTS (SELECT 1 FROM skills WHERE title='HTML Developer');
INSERT INTO skills (title, description, icon_url, sort_order)
SELECT 'CSS Developer', 'Creating responsive designs with CSS3, Flexbox, and Grid.', './public/icons/css.png', 2
WHERE NOT EXISTS (SELECT 1 FROM skills WHERE title='CSS Developer');
INSERT INTO skills (title, description, icon_url, sort_order)
SELECT 'JavaScript Developer', 'Building dynamic web applications with ES6 and DOM manipulation.', './public/icons/js.png', 3
WHERE NOT EXISTS (SELECT 1 FROM skills WHERE title='JavaScript Developer');
INSERT INTO skills (title, description, icon_url, sort_order)
SELECT 'C++ Programmer', 'Developing high-performance applications with OOP principles.', './public/icons/c++.png', 4
WHERE NOT EXISTS (SELECT 1 FROM skills WHERE title='C++ Programmer');
INSERT INTO skills (title, description, icon_url, sort_order)
SELECT 'Python Developer', 'Building scalable applications with Python and data analysis tools.', './public/icons/python.png', 5
WHERE NOT EXISTS (SELECT 1 FROM skills WHERE title='Python Developer');

INSERT INTO projects (title, description, image_url, project_url, github_url, sort_order)
SELECT 'CLI Library Management System [CRUD]', 'A command-line library management system using CRUD operations and MySQL to manage books, members, and transactions.', './public/icons/c++.png', 'https://github.com/shivamsharma-builds/Library_Management/tree/main', 'https://github.com/shivamsharma-builds/Library_Management/tree/main', 1
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE title='CLI Library Management System [CRUD]');
INSERT INTO projects (title, description, image_url, project_url, github_url, sort_order)
SELECT 'Weather App Using API', 'A JavaScript weather app that fetches live API data and displays temperature, humidity, conditions, and other weather details.', './public/icons/js.png', 'https://weather-main-xfqp.onrender.com', '', 2
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE title='Weather App Using API');
INSERT INTO projects (title, description, image_url, project_url, github_url, sort_order)
SELECT 'Crop Prediction Using AI', 'An AI-powered agricultural project that predicts suitable crops using soil, weather, temperature, rainfall, and historical data.', './public/icons/vite.png', 'https://ai-crop-prediction.onrender.com', '', 3
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE title='Crop Prediction Using AI');
INSERT INTO projects (title, description, image_url, project_url, github_url, sort_order)
SELECT 'Spotify Clone', 'A music-streaming UI inspired by Spotify, featuring song browsing, playlists, and playback-focused interface components.', './public/icons/js.png', 'https://spotifycloneshivam.netlify.app/', '', 4
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE title='Spotify Clone');
