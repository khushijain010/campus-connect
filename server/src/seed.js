// Demo data so every screen has meaningful content on first run.
// `npm run seed` wipes the database and re-seeds it; the server seeds automatically when the DB is empty.
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, getDb, q, DATA_DIR } from './db.js';
import { activityConversation, communityConversation } from './services.js';
import { UPLOAD_DIR } from './upload.js';
import { collegeEmail } from './constants.js';

// A small but valid one-page PDF so the demo attachment actually opens.
function writeDemoPdf(name, lines) {
  const text = lines.map((l, i) => `BT /F1 ${i ? 12 : 18} Tf 60 ${760 - i * 26} Td (${l.replace(/[()\\]/g, '')}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), pdf);
  return { url: `/uploads/${name}`, name, size: Buffer.byteLength(pdf), type: 'PDF' };
}

export const DEMO_PASSWORD = 'password123';
export const DEMO_EMAIL = 'arjunm@cse.iitr.ac.in';

// Deterministic PRNG so demo data is stable between runs.
let seedState = 42;
const rand = () => { seedState = (seedState * 1664525 + 1013904223) % 4294967296; return seedState / 4294967296; };
const pick = (arr, n) => [...arr].sort(() => rand() - 0.5).slice(0, n);

const pad = (n) => String(n).padStart(2, '0');
const sqlTime = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
const hoursAgo = (h) => sqlTime(new Date(Date.now() - h * 3.6e6));
const dayOffset = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const img = (key, w = 800, h = 600) => `https://picsum.photos/seed/cc-${key}/${w}/${h}`;
const J = JSON.stringify;

const USERS = [
  { key: 'arjun', name: 'Arjun Mehta', handle: 'arjunm', dept: 'CSE', year: '3rd', region: 'Rajasthan',
    courses: ['OS', 'DBMS', 'ML'], skills: ['Python', 'React', 'C++'], hobbies: ['Football', 'Music', 'Photography'], interests: ['AI/ML', 'CP'],
    clubs: ['Programming', 'Sports'], langs: ['Hindi', 'English', 'Marwari'], langWant: ['Japanese', 'Tamil'], ci: ['Food', 'Festivals', 'Music'],
    foods: ['Dal Baati', 'Biryani'], fests: ['Diwali', 'Holi'], music: ['Bollywood', 'Indie'], avail: ['Evening'],
    bio: 'Interested in AI/ML, football and cultural exchanges. Always up for good conversations and new experiences!' },
  { key: 'riya', name: 'Riya Singh', handle: 'riya.s', dept: 'ECE', year: '2nd', region: 'Gujarat',
    courses: ['DSP', 'Networks'], skills: ['MATLAB', 'Python'], hobbies: ['Photography', 'Music'], interests: ['Electronics', 'AI/ML'],
    clubs: ['Photography', 'Cultural'], langs: ['Gujarati', 'Hindi', 'English'], langWant: ['French'], ci: ['Dance', 'Festivals', 'Music'],
    foods: ['Dhokla', 'Thepla'], fests: ['Navratri', 'Diwali'], music: ['Folk', 'Bollywood'], avail: ['Afternoon', 'Evening'],
    bio: 'Interested in photography, music and cultural events. Always up for interesting conversations! Garba enthusiast.' },
  { key: 'kabir', name: 'Kabir Khan', handle: 'kabirk', dept: 'Mechanical', year: '3rd', region: 'Uttar Pradesh',
    courses: ['Mathematics', 'ML'], skills: ['Python', 'Arduino'], hobbies: ['Football', 'Reading'], interests: ['Robotics', 'AI/ML'],
    clubs: ['Robotics', 'Sports'], langs: ['Hindi', 'Urdu', 'English'], langWant: ['Bengali'], ci: ['Food', 'Music'],
    foods: ['Kebabs', 'Biryani'], fests: ['Eid', 'Diwali'], music: ['Classical', 'Indie'], avail: ['Morning', 'Evening'],
    bio: 'Building robots and reading Urdu poetry. Football on weekends.' },
  { key: 'ananya', name: 'Ananya Verma', handle: 'ananya.v', dept: 'CSE', year: '3rd', region: 'Kerala',
    courses: ['OS', 'DBMS', 'DSA'], skills: ['C++', 'React', 'Python'], hobbies: ['Reading', 'Music'], interests: ['CP', 'Research'],
    clubs: ['Programming', 'Cultural'], langs: ['Malayalam', 'English', 'Hindi'], langWant: ['Japanese'], ci: ['Food', 'Festivals', 'Dance'],
    foods: ['Appam', 'Puttu', 'Dosa'], fests: ['Onam', 'Vishu'], music: ['Classical', 'Anime'], avail: ['Evening'],
    bio: 'Competitive programmer, Onam sadya evangelist and Bharatanatyam learner.' },
  { key: 'dev', name: 'Dev Patel', handle: 'devp', dept: 'Civil', year: '4th', region: 'Maharashtra',
    courses: ['Mathematics'], skills: ['MATLAB', 'Python'], hobbies: ['Cycling', 'Photography', 'Sports'], interests: ['Research', 'Finance'],
    clubs: ['Sports', 'Photography'], langs: ['Marathi', 'Hindi', 'English'], langWant: ['French'], ci: ['Food', 'Art'],
    foods: ['Vada Pav', 'Misal'], fests: ['Ganesh Chaturthi', 'Diwali'], music: ['Indie'], avail: ['Morning'],
    bio: 'Final year civil. Early-morning cyclist, weekend photographer.' },
  { key: 'meera', name: 'Meera Sharma', handle: 'meera.sh', dept: 'ECE', year: '2nd', region: 'Punjab',
    courses: ['DSP', 'Networks'], skills: ['Verilog', 'MATLAB'], hobbies: ['Music', 'Photography'], interests: ['Electronics', 'Research'],
    clubs: ['Cultural', 'Photography'], langs: ['Punjabi', 'Hindi', 'English'], langWant: ['Korean'], ci: ['Music', 'Dance', 'Food'],
    foods: ['Sarson da Saag', 'Lassi'], fests: ['Lohri', 'Baisakhi'], music: ['Folk', 'K-Pop'], avail: ['Evening'],
    bio: 'VLSI curious. Bhangra on the weekends, K-Pop on repeat.' },
  { key: 'arjunn', name: 'Arjun Nair', handle: 'arjun.nair', dept: 'Electrical', year: '2nd', region: 'Kerala',
    courses: ['DSP', 'Mathematics'], skills: ['MATLAB', 'Arduino'], hobbies: ['Football', 'Sports', 'Gaming'], interests: ['Electronics', 'Robotics'],
    clubs: ['Sports', 'Robotics'], langs: ['Malayalam', 'English', 'Tamil'], langWant: ['Hindi'], ci: ['Food', 'Festivals'],
    foods: ['Appam', 'Fish Curry'], fests: ['Onam', 'Christmas'], music: ['Folk'], avail: ['Evening'],
    bio: 'Football every evening. Ask me about Kerala boat races.' },
  { key: 'sneha', name: 'Sneha Iyer', handle: 'sneha.iyer', dept: 'CSE', year: '2nd', region: 'Tamil Nadu',
    courses: ['DSA', 'DBMS'], skills: ['Python', 'React'], hobbies: ['Reading', 'Music'], interests: ['AI/ML', 'Research'],
    clubs: ['Cultural', 'Programming'], langs: ['Tamil', 'English', 'Hindi'], langWant: ['Japanese', 'Bengali'], ci: ['Music', 'Dance', 'Art'],
    foods: ['Dosa', 'Pongal', 'Filter Coffee'], fests: ['Pongal', 'Diwali'], music: ['Classical', 'Anime'], avail: ['Morning', 'Evening'],
    bio: 'Carnatic music, NLP research and an endless TBR pile.' },
  { key: 'rohan', name: 'Rohan Gupta', handle: 'rohang', dept: 'CSE', year: '4th', region: 'Delhi',
    courses: ['OS', 'Networks', 'ML'], skills: ['C++', 'Python', 'React'], hobbies: ['Gaming', 'Photography'], interests: ['CP', 'AI/ML', 'Finance'],
    clubs: ['Programming'], langs: ['Hindi', 'English'], langWant: ['Japanese', 'Korean'], ci: ['Food', 'Music'],
    foods: ['Chole Bhature', 'Momos'], fests: ['Diwali', 'Holi'], music: ['Indie', 'Anime'], avail: ['Evening'],
    bio: 'System design nerd. Interning at a fintech this winter.' },
  { key: 'priya', name: 'Priya Nair', handle: 'priya.nair', dept: 'Mechanical', year: '3rd', region: 'Rajasthan',
    courses: ['ML', 'Mathematics'], skills: ['Python', 'MATLAB'], hobbies: ['Photography', 'Music'], interests: ['AI/ML', 'Robotics'],
    clubs: ['Photography', 'Robotics'], langs: ['Hindi', 'English', 'Rajasthani'], langWant: ['Malayalam'], ci: ['Art', 'Food', 'Festivals'],
    foods: ['Ghewar', 'Dal Baati'], fests: ['Teej', 'Diwali'], music: ['Folk'], avail: ['Evening'],
    bio: 'Mechanical + ML. I photograph old havelis and teach Ghoomar.' },
  { key: 'ishita', name: 'Ishita Rao', handle: 'ishita.rao', dept: 'Civil', year: '3rd', region: 'Karnataka',
    courses: ['Mathematics'], skills: ['Figma'], hobbies: ['Photography', 'Reading'], interests: ['Research'],
    clubs: ['Cultural'], langs: ['Kannada', 'English', 'Hindi'], langWant: ['French', 'Japanese'], ci: ['Festivals', 'Art', 'Dance'],
    foods: ['Bisi Bele Bath', 'Mysore Pak'], fests: ['Dasara', 'Onam'], music: ['Classical'], avail: ['Afternoon'],
    bio: 'Urban design, Yakshagana and long walks with a camera.' },
  { key: 'karan', name: 'Karan Singh', handle: 'karan.singh', dept: 'Mechanical', year: '2nd', region: 'Punjab',
    courses: ['Mathematics'], skills: ['Arduino'], hobbies: ['Sports', 'Music', 'Football'], interests: ['Robotics'],
    clubs: ['Sports', 'Cultural'], langs: ['Punjabi', 'Hindi', 'English'], langWant: ['Spanish'], ci: ['Music', 'Dance', 'Food'],
    foods: ['Makki di Roti', 'Lassi'], fests: ['Baisakhi', 'Lohri'], music: ['Folk', 'Bollywood'], avail: ['Morning', 'Evening'],
    bio: 'Dhol player, striker, and the loudest person at every match.' },
  { key: 'meerad', name: 'Meera Das', handle: 'meera.das', dept: 'ECE', year: '3rd', region: 'West Bengal',
    courses: ['DSP', 'ML'], skills: ['Python', 'MATLAB'], hobbies: ['Reading', 'Music'], interests: ['AI/ML', 'Research'],
    clubs: ['Cultural'], langs: ['Bengali', 'Hindi', 'English'], langWant: ['Japanese'], ci: ['Food', 'Music', 'Art'],
    foods: ['Rasgulla', 'Machher Jhol'], fests: ['Durga Puja', 'Diwali'], music: ['Classical', 'Folk'], avail: ['Evening'],
    bio: 'Rabindrasangeet, signal processing and the best mishti doi recipe.' },
  { key: 'rahul', name: 'Rahul Nair', handle: 'rahul.nair', dept: 'CSE', year: '1st', region: 'Kerala',
    courses: ['DSA', 'Mathematics'], skills: ['C++', 'Python'], hobbies: ['Gaming', 'Football'], interests: ['CP'],
    clubs: ['Programming', 'Sports'], langs: ['Malayalam', 'English'], langWant: ['Hindi', 'Japanese'], ci: ['Food', 'Festivals'],
    foods: ['Appam', 'Puttu'], fests: ['Onam'], music: ['Anime'], avail: ['Evening'],
    bio: 'Fresher, learning DSA and Hindi at the same time.' },
  { key: 'aiko', name: 'Aiko Tanaka', handle: 'aiko.t', dept: 'ECE', year: '3rd', region: 'Japan',
    courses: ['DSP', 'ML'], skills: ['Python', 'C++'], hobbies: ['Photography', 'Music', 'Gaming'], interests: ['AI/ML', 'Robotics'],
    clubs: ['Photography', 'Cultural'], langs: ['Japanese', 'English'], langWant: ['Hindi', 'Tamil'], ci: ['Food', 'Festivals', 'Art'],
    foods: ['Sushi', 'Ramen'], fests: ['Hanami', 'Obon'], music: ['Anime', 'Indie'], avail: ['Afternoon', 'Evening'],
    bio: 'Exchange student from Osaka. Happy to teach Japanese, eager to learn Hindi!' },
  { key: 'lalit', name: 'Lalit Bora', handle: 'lalit.bora', dept: 'Electrical', year: '3rd', region: 'Assam',
    courses: ['Networks', 'Mathematics'], skills: ['Python', 'Arduino'], hobbies: ['Music', 'Sports', 'Cycling'], interests: ['Electronics', 'Finance'],
    clubs: ['Cultural', 'Sports'], langs: ['Assamese', 'Hindi', 'English'], langWant: ['Tamil'], ci: ['Festivals', 'Music', 'Dance'],
    foods: ['Pitha', 'Momos', 'Masor Tenga'], fests: ['Bihu'], music: ['Folk'], avail: ['Morning', 'Evening'],
    bio: 'Bihu dancer, tea connoisseur, and power systems enthusiast.' },
  { key: 'minji', name: 'Minji Park', handle: 'minji.p', dept: 'CSE', year: '2nd', region: 'South Korea',
    courses: ['DBMS', 'OS'], skills: ['React', 'Python'], hobbies: ['Music', 'Photography'], interests: ['AI/ML', 'CP'],
    clubs: ['Cultural', 'Programming'], langs: ['Korean', 'English'], langWant: ['Hindi', 'Punjabi'], ci: ['Food', 'Music', 'Dance'],
    foods: ['Kimchi', 'Tteokbokki'], fests: ['Chuseok', 'Seollal'], music: ['K-Pop', 'Indie'], avail: ['Evening'],
    bio: 'Exchange student from Seoul. Will trade Korean lessons for Bollywood dance tips.' },
  { key: 'neha', name: 'Neha Singh', handle: 'neha.singh', dept: 'CSE', year: '3rd', region: 'Bihar',
    courses: ['ML', 'DBMS'], skills: ['Python', 'React'], hobbies: ['Music', 'Reading'], interests: ['AI/ML', 'Finance'],
    clubs: ['Cultural'], langs: ['Hindi', 'Bhojpuri', 'English'], langWant: ['French'], ci: ['Food', 'Festivals', 'Music'],
    foods: ['Litti Chokha', 'Thekua'], fests: ['Chhath', 'Diwali'], music: ['Folk', 'Bollywood'], avail: ['Evening'],
    bio: 'Litti Chokha ambassador. Open-mic regular.' },
  { key: 'muskan', name: 'Muskan Jain', handle: 'muskan.j', dept: 'CSE', year: '2nd', region: 'Madhya Pradesh',
    courses: ['DSA', 'OS'], skills: ['React', 'Figma'], hobbies: ['Photography', 'Gaming'], interests: ['CP', 'AI/ML'],
    clubs: ['Programming'], langs: ['Hindi', 'English'], langWant: ['Korean'], ci: ['Art', 'Food'],
    foods: ['Poha', 'Jalebi'], fests: ['Diwali', 'Holi'], music: ['Indie'], avail: ['Afternoon', 'Evening'],
    bio: 'Frontend + design. Always forming hackathon teams.' },
  { key: 'tenzin', name: 'Tenzin Lepcha', handle: 'tenzin.l', dept: 'Civil', year: '1st', region: 'Sikkim',
    courses: ['Mathematics'], skills: ['MATLAB'], hobbies: ['Cycling', 'Photography', 'Music'], interests: ['Research'],
    clubs: ['Photography', 'Sports'], langs: ['Nepali', 'English', 'Hindi'], langWant: ['Japanese'], ci: ['Food', 'Festivals'],
    foods: ['Momos', 'Thukpa'], fests: ['Losar'], music: ['Folk', 'Indie'], avail: ['Morning'],
    bio: 'Mountain kid. Will make you momos if you join the morning ride.' },
];

const COMMUNITIES = [
  ['AI/ML Club', 'Academic', 0, ['AI/ML', 'ML', 'Python', 'Research'], '🧠', '#4f46e5', 'Papers, projects and study jams on machine learning.'],
  ['CP Club', 'Academic', 0, ['CP', 'DSA', 'C++', 'Hackathon'], '💻', '#0ea5e9', 'Contests, upsolving sessions and interview prep.'],
  ['Electronics Society', 'Academic', 0, ['Electronics', 'DSP', 'Verilog', 'Arduino'], '🔌', '#0891b2', 'From breadboards to FPGAs.'],
  ['Research Circle', 'Academic', 0, ['Research', 'Paper', 'ML'], '🔬', '#7c3aed', 'Paper reading groups and research mentorship.'],
  ['Photography Club', 'Hobbies', 0, ['Photography', 'Camera', 'Photowalk'], '📷', '#334155', 'Photowalks, critiques and editing workshops.'],
  ['Music & Jam', 'Hobbies', 0, ['Music', 'Jam', 'Guitar'], '🎸', '#db2777', 'Open jams every Friday night.'],
  ['Book Club', 'Hobbies', 0, ['Reading', 'Books'], '📚', '#b45309', 'One book a month, chai included.'],
  ['Podcast Circle', 'Hobbies', 0, ['Podcast', 'Music'], '🎙️', '#9333ea', 'Record, edit and share campus stories.'],
  ['Movie Buffs', 'Entertainment', 0, ['Movies', 'Anime'], '🎬', '#dc2626', 'Weekly screenings and spirited debates.'],
  ['Gaming Guild', 'Entertainment', 0, ['Gaming', 'Games', 'Esports'], '🎮', '#16a34a', 'LAN parties, board games and esports.'],
  ['Netflix & Series', 'Entertainment', 0, ['Netflix', 'Movies'], '📺', '#e11d48', 'What are you binging this week?'],
  ['Football Enthusiasts', 'Sports', 0, ['Football', 'Sports'], '⚽', '#15803d', 'Evening matches at the sports ground.'],
  ['Cricket Club', 'Sports', 0, ['Cricket', 'Sports'], '🏏', '#65a30d', 'Nets, tape-ball and inter-hostel leagues.'],
  ['Cycling Group', 'Sports', 0, ['Cycling', 'Sports'], '🚴', '#ea580c', 'Sunrise rides around campus and beyond.'],
  ['Language Exchange', 'Culture', 1, ['Language', 'Culture'], '🗣️', '#2563eb', 'Trade languages: teach one, learn one.'],
  ['Cultural Exchange', 'Culture', 1, ['Culture', 'Festivals', 'Food', 'Traditions', 'Music'], '🎎', '#f97316', 'A space to share, learn and celebrate different cultures, traditions, festivals and experiences.'],
  ['Regional Food', 'Culture', 1, ['Food', 'Culture'], '🍛', '#ca8a04', 'Recipes, food walks and potlucks from every state.'],
  ['North Indian Culture', 'Culture', 1, ['Culture', 'Punjab', 'Rajasthan', 'Festivals'], '🕌', '#c2410c', 'Lohri bonfires to Rajasthani folk nights.'],
  ['South Indian Culture', 'Culture', 1, ['Culture', 'Kerala', 'Tamil', 'Festivals'], '🛕', '#a16207', 'Onam, Pongal, Carnatic and everything in between.'],
  ['Northeast India', 'Culture', 1, ['Culture', 'Assam', 'Bihu', 'Festivals'], '⛰️', '#047857', 'Seven sisters, one community.'],
  ['Japanese Culture', 'Culture', 1, ['Culture', 'Japanese', 'Anime'], '⛩️', '#be123c', 'Language, anime, origami and tea.'],
  ['Korean Culture', 'Culture', 1, ['Culture', 'Korean', 'K-Pop'], '🇰🇷', '#1d4ed8', 'K-dramas, K-food and Hangul practice.'],
  ['European Culture', 'Culture', 1, ['Culture', 'French', 'German'], '🏰', '#4338ca', 'Languages, films and festivals of Europe.'],
  ['World Music', 'Culture', 1, ['Music', 'Culture', 'Folk'], '🌍', '#0f766e', 'Folk, classical and everything global.'],
];

const COMMUNITY_MEMBERS = {
  arjun: ['AI/ML Club', 'Football Enthusiasts', 'Photography Club', 'North Indian Culture', 'Cultural Exchange'],
  riya: ['Photography Club', 'Cultural Exchange', 'Music & Jam', 'Electronics Society'],
  kabir: ['AI/ML Club', 'Football Enthusiasts', 'Book Club', 'Cultural Exchange'],
  ananya: ['CP Club', 'South Indian Culture', 'Cultural Exchange', 'Language Exchange', 'Book Club'],
  dev: ['Cycling Group', 'Photography Club', 'Football Enthusiasts'],
  meera: ['Electronics Society', 'Music & Jam', 'Korean Culture', 'Cultural Exchange'],
  arjunn: ['Football Enthusiasts', 'South Indian Culture', 'Gaming Guild'],
  sneha: ['AI/ML Club', 'Book Club', 'South Indian Culture', 'Language Exchange'],
  rohan: ['CP Club', 'AI/ML Club', 'Photography Club', 'Gaming Guild'],
  priya: ['Photography Club', 'North Indian Culture', 'AI/ML Club', 'Regional Food'],
  ishita: ['Photography Club', 'South Indian Culture', 'Movie Buffs'],
  karan: ['Football Enthusiasts', 'North Indian Culture', 'Music & Jam', 'Cricket Club'],
  meerad: ['Regional Food', 'World Music', 'Cultural Exchange', 'Research Circle'],
  rahul: ['CP Club', 'Gaming Guild', 'South Indian Culture'],
  aiko: ['Japanese Culture', 'Language Exchange', 'Photography Club', 'Cultural Exchange'],
  lalit: ['Northeast India', 'Cycling Group', 'World Music', 'Cultural Exchange'],
  minji: ['Korean Culture', 'Language Exchange', 'Music & Jam'],
  neha: ['Regional Food', 'North Indian Culture', 'AI/ML Club', 'Podcast Circle'],
  muskan: ['CP Club', 'Gaming Guild', 'Netflix & Series'],
  tenzin: ['Northeast India', 'Cycling Group', 'Photography Club'],
};
const ADMINS = { 'Cultural Exchange': ['ananya', 'rohan'], 'AI/ML Club': ['kabir'], 'Photography Club': ['rohan'], 'Football Enthusiasts': ['karan'] };

const CULTURES = [
  ['Northeast India', 'Seven sisters, endless stories', 'Explore the vibrant cultures, unique traditions and breathtaking landscapes of Northeast India.', '⛰️', '#047857',
    { regions: ['Assam', 'Sikkim', 'Meghalaya', 'Manipur', 'Nagaland', 'Mizoram', 'Tripura', 'Arunachal Pradesh'], Food: ['Momos', 'Thukpa', 'Pitha', 'Masor Tenga'], Festivals: ['Bihu', 'Losar', 'Hornbill Festival'], Music: ['Bihu songs', 'Naga folk'], Language: ['Assamese', 'Nepali', 'Khasi'], Traditions: ['Gamosa weaving', 'Bamboo dance'] }],
  ['South India', 'Temples, tunes and tiffin', 'From Carnatic concerts to banana-leaf feasts, discover the traditions of the southern states.', '🛕', '#a16207',
    { regions: ['Kerala', 'Tamil Nadu', 'Karnataka', 'Andhra Pradesh', 'Telangana'], Food: ['Dosa', 'Appam', 'Pongal', 'Bisi Bele Bath'], Festivals: ['Onam', 'Pongal', 'Dasara', 'Ugadi'], Music: ['Carnatic', 'Kathakali'], Language: ['Tamil', 'Malayalam', 'Kannada', 'Telugu'], Traditions: ['Kolam', 'Snake boat races'] }],
  ['Japan', 'Land of the rising sun', 'Tea ceremonies, cherry blossoms and anime — get to know Japanese culture from our exchange students.', '⛩️', '#be123c',
    { regions: ['Japan'], Food: ['Sushi', 'Ramen', 'Onigiri'], Festivals: ['Hanami', 'Obon', 'Tanabata'], Music: ['J-Pop', 'Taiko'], Language: ['Japanese'], Traditions: ['Origami', 'Tea ceremony'] }],
  ['Punjab', 'Land of five rivers', 'Bhangra beats, langar and the warmth of Punjabi hospitality.', '🌾', '#c2410c',
    { regions: ['Punjab', 'Haryana'], Food: ['Sarson da Saag', 'Makki di Roti', 'Lassi'], Festivals: ['Baisakhi', 'Lohri'], Music: ['Bhangra', 'Dhol'], Language: ['Punjabi'], Traditions: ['Langar', 'Phulkari'] }],
  ['Bengal', 'Art, adda and mishti', 'Durga Puja pandals, Rabindrasangeet and the sweetest sweets in India.', '🎨', '#b91c1c',
    { regions: ['West Bengal', 'Bangladesh'], Food: ['Rasgulla', 'Machher Jhol', 'Mishti Doi'], Festivals: ['Durga Puja', 'Poila Boishakh'], Music: ['Rabindrasangeet', 'Baul'], Language: ['Bengali'], Traditions: ['Alpona', 'Adda'] }],
  ['Kerala', "God's own country", 'Backwaters, boat races, Kathakali and the grand Onam sadya.', '🌴', '#15803d',
    { regions: ['Kerala'], Food: ['Appam', 'Puttu', 'Sadya'], Festivals: ['Onam', 'Vishu'], Music: ['Sopana Sangeetham'], Language: ['Malayalam'], Traditions: ['Vallam Kali', 'Pookalam'] }],
  ['Rajasthan', 'Desert colours', 'Forts, folk music and the vibrant colours of the Thar.', '🐪', '#d97706',
    { regions: ['Rajasthan'], Food: ['Dal Baati', 'Ghewar'], Festivals: ['Teej', 'Pushkar Fair'], Music: ['Manganiyar folk'], Language: ['Rajasthani', 'Marwari'], Traditions: ['Ghoomar', 'Puppetry'] }],
  ['Korea', 'Hallyu and heritage', 'Beyond K-Pop: hanbok, kimchi-making and Korean university life.', '🇰🇷', '#1d4ed8',
    { regions: ['South Korea'], Food: ['Kimchi', 'Bibimbap', 'Tteokbokki'], Festivals: ['Chuseok', 'Seollal'], Music: ['K-Pop', 'Pansori'], Language: ['Korean'], Traditions: ['Hanbok', 'Jesa'] }],
];

export function seed() {
  const db = getDb();
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const id = {};
  db.exec('BEGIN');
  try {
    for (const [i, u] of USERS.entries()) {
      const info = q.run(`INSERT INTO users (name, handle, email, password_hash, department, year, courses, skills, hobbies, interests, clubs, bio,
        region, languages_spoken, languages_interested, cultural_interests, foods, festivals, music_art, availability, last_seen, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      u.name, u.handle, collegeEmail(u.handle.replace('.', ''), u.dept), hash, u.dept, u.year, J(u.courses), J(u.skills), J(u.hobbies), J(u.interests),
      J(u.clubs), u.bio, u.region, J(u.langs), J(u.langWant), J(u.ci), J(u.foods), J(u.fests), J(u.music), J(u.avail),
      i % 3 === 0 ? hoursAgo(0.02) : hoursAgo(2 + i), hoursAgo(24 * 60 - i));
      id[u.key] = Number(info.lastInsertRowid);
    }

    // Friendships
    const friends = [['arjun', 'riya'], ['arjun', 'kabir'], ['arjun', 'ananya'], ['arjun', 'dev'], ['arjun', 'meera'],
      ['riya', 'meera'], ['riya', 'ananya'], ['kabir', 'dev'], ['ananya', 'sneha'], ['rohan', 'muskan'], ['karan', 'meera'],
      ['aiko', 'minji'], ['lalit', 'tenzin'], ['neha', 'meerad'], ['arjunn', 'rahul'], ['arjun', 'rohan']];
    for (const [a, b] of friends) q.run("INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'accepted')", id[a], id[b]);
    q.run("INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')", id.priya, id.arjun);
    q.run("INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')", id.aiko, id.arjun);

    // Communities
    const cid = {};
    for (const [name, category, cultural, tags, emoji, color, description] of COMMUNITIES) {
      cid[name] = Number(q.run('INSERT INTO communities (name, description, category, is_cultural, tags, emoji, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
        name, description, category, cultural, J(tags), emoji, color).lastInsertRowid);
    }
    for (const [user, list] of Object.entries(COMMUNITY_MEMBERS)) {
      for (const name of list) {
        const role = ADMINS[name]?.includes(user) ? 'admin' : 'member';
        q.run('INSERT INTO community_members (community_id, user_id, role) VALUES (?, ?, ?)', cid[name], id[user], role);
      }
    }

    for (const [name, tagline, description, emoji, color, topics] of CULTURES) {
      q.run('INSERT INTO cultures (name, tagline, description, emoji, color, topics) VALUES (?, ?, ?, ?, ?, ?)', name, tagline, description, emoji, color, J(topics));
    }

    // Activities: [creator, kind, type, category, title, desc, dayOffset, time, location, capacity, extra]
    const aid = {};
    const act = (key, creator, kind, type, category, title, description, day, time, location, capacity, extra = {}) => {
      const info = q.run(`INSERT INTO activities (creator_id, kind, type, category, title, description, date, time, location, capacity, requirements,
        level, department, course, looking_for, skills, tags, is_cultural_exchange, emoji, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id[creator], kind, type, category, title, description, dayOffset(day), time, location, capacity, J(extra.requirements || []),
      extra.level || 'Beginner', extra.department || null, extra.course || null, J(extra.lookingFor || []), J(extra.skills || []),
      J(extra.tags || []), extra.cultural ? 1 : 0, extra.emoji || '📅', day < 0 ? 'completed' : 'open');
      aid[key] = Number(info.lastInsertRowid);
      q.run("INSERT INTO activity_members (activity_id, user_id, status) VALUES (?, ?, 'accepted')", aid[key], id[creator]);
    };

    // Study partners
    act('dsp', 'riya', 'study', 'Study', 'Study', 'DSP Study Group', 'Working through z-transforms and filter design before the mid-sem.', 1, '18:00', 'Library', 6, { course: 'DSP', department: 'ECE', level: 'Intermediate', tags: ['DSP', 'Electronics'], emoji: '📡' });
    act('os', 'ananya', 'study', 'Study', 'Study', 'OS Mid-sem Prep', 'Scheduling, paging and deadlocks — solving past papers together.', 2, '19:00', 'Library', 5, { course: 'OS', department: 'CSE', level: 'Intermediate', tags: ['OS'], emoji: '🖥️' });
    act('dbms', 'sneha', 'study', 'Study', 'Study', 'DBMS Problem Solving', 'Normalization and SQL query practice. Bring your laptop.', 3, '10:00', 'Online', 8, { course: 'DBMS', level: 'Beginner', tags: ['DBMS', 'SQL'], requirements: ['Laptop'], emoji: '🗄️' });
    act('ml', 'kabir', 'study', 'Study', 'Study', 'ML Paper Reading', 'This week: “Attention Is All You Need”. Light discussion, no prep needed.', 4, '17:30', 'Online', 10, { course: 'ML', level: 'Advanced', tags: ['ML', 'AI/ML', 'Research'], emoji: '🧠' });
    act('dsa', 'rahul', 'study', 'Study', 'Study', 'DSA Practice Sprint', 'Two hours of graph problems, then we upsolve.', 0, '20:00', 'Campus', 4, { course: 'DSA', level: 'Beginner', tags: ['DSA', 'CP'], emoji: '🧩' });
    act('maths', 'dev', 'study', 'Study', 'Study', 'Mathematics Doubt Session', 'Linear algebra + probability doubts for first and second years.', 5, '08:00', 'Library', 8, { course: 'Mathematics', level: 'Beginner', tags: ['Mathematics'], emoji: '📐' });

    // Projects
    act('traffic', 'arjun', 'project', 'Project', 'Projects', 'AI-based Traffic Detection', 'Detect and count vehicles at campus gates with a camera + edge device. Aiming for the Inter-IIT tech meet.', 20, '18:00', 'Campus', 5,
      { lookingFor: ['ML', 'Frontend', 'Hardware'], skills: ['Python', 'OpenCV', 'Arduino'], tags: ['AI/ML', 'Hackathon', 'Robotics'], level: 'Intermediate', emoji: '🚦' });
    act('grid', 'dev', 'project', 'Project', 'Projects', 'Project Team – Smart Grid', 'IoT monitor for hostel power usage with a live dashboard.', 25, '17:00', 'Campus', 4,
      { lookingFor: ['Hardware', 'Frontend'], skills: ['Arduino', 'React'], tags: ['Electronics', 'Research'], level: 'Intermediate', emoji: '⚡' });
    act('eventapp', 'muskan', 'project', 'Project', 'Projects', 'Hackathon: Campus Events App', 'Looking for one frontend dev and one designer for the campus hackathon.', 9, '21:00', 'Online', 4,
      { lookingFor: ['Frontend', 'Design'], skills: ['React', 'Figma'], tags: ['Hackathon', 'CP', 'React'], level: 'Beginner', emoji: '📱' });
    act('fpga', 'meera', 'project', 'Project', 'Projects', 'FPGA Audio Equalizer', 'Real-time 5-band equalizer on an FPGA board.', 30, '16:00', 'Campus', 3,
      { lookingFor: ['Hardware', 'DSP'], skills: ['Verilog', 'MATLAB'], tags: ['Electronics', 'DSP'], level: 'Advanced', emoji: '🎛️' });

    // Sports
    act('football', 'karan', 'sports', 'Sports', 'Sports', 'Football 5-a-side', 'Friendly evening match. All levels welcome.', 1, '17:30', 'Sports Ground', 10, { tags: ['Football', 'Sports'], requirements: ['Sports Equipment'], emoji: '⚽' });
    act('cricket', 'karan', 'sports', 'Sports', 'Sports', 'Cricket Net Practice', 'Bring your own bat if you have one.', 3, '07:00', 'Sports Ground', 12, { tags: ['Cricket', 'Sports'], emoji: '🏏' });
    act('badminton', 'arjunn', 'sports', 'Sports', 'Sports', 'Badminton Doubles', 'Looking for 2 more for doubles at the indoor court.', 0, '19:30', 'Sports Ground', 4, { tags: ['Badminton', 'Sports'], level: 'Intermediate', emoji: '🏸' });
    act('cycling', 'tenzin', 'sports', 'Sports', 'Sports', 'Sunrise Cycling Loop', '15 km easy-paced loop around the canal.', 6, '06:00', 'Campus', 8, { tags: ['Cycling', 'Sports'], emoji: '🚴' });
    act('running', 'lalit', 'sports', 'Sports', 'Sports', 'Running Club 5K', 'Easy 5K, then chai at the canteen.', 2, '06:30', 'Sports Ground', 15, { tags: ['Running', 'Sports'], emoji: '🏃' });
    act('basketball', 'rohan', 'sports', 'Sports', 'Sports', 'Basketball Pickup', 'Half-court pickup games, rotate every 10 points.', 4, '18:30', 'Sports Ground', 10, { tags: ['Basketball', 'Sports'], emoji: '🏀' });

    // Hobby events
    act('photowalk', 'dev', 'event', 'Hobby', 'Hobbies', 'Photography Walk', 'Golden-hour walk around the heritage buildings. Phones welcome too!', 6, '17:00', 'IITR Campus', 8, { tags: ['Photography'], requirements: ['Camera'], emoji: '📷' });
    act('boardgames', 'muskan', 'event', 'Hobby', 'Games', 'Board Games Night', 'Catan, Codenames and chaos.', 2, '20:30', 'Campus', 12, { tags: ['Gaming', 'Games'], emoji: '🎲' });
    act('valorant', 'rahul', 'event', 'Hobby', 'Games', 'Valorant 5v5 Scrims', 'Inter-hostel practice scrims.', 5, '22:00', 'Online', 10, { tags: ['Gaming', 'Esports'], level: 'Intermediate', emoji: '🎮' });
    act('bookclub', 'sneha', 'event', 'Hobby', 'Hobbies', 'Book Club: Kafka on the Shore', 'Discussing chapters 1–15.', 8, '16:00', 'Library', 10, { tags: ['Reading', 'Books'], emoji: '📖' });
    act('aiws', 'kabir', 'event', 'Study', 'Events', 'AI/ML Workshop', 'Hands-on intro to PyTorch: build an image classifier in 90 minutes.', 7, '15:00', 'Online', 40, { tags: ['AI/ML', 'ML', 'Python'], requirements: ['Laptop'], emoji: '🤖' });
    act('interiit', 'rohan', 'event', 'Cultural', 'Culture', 'Inter-IIT Cultural Fest', 'Representing the institute in dance, music and dramatics. Auditions this week.', 12, '10:00', 'IITR Campus', 30, { tags: ['Culture', 'Music', 'Dance'], cultural: true, emoji: '🏆' });

    // Cultural exchange events
    act('foodex', 'neha', 'event', 'Cultural', 'Culture', 'Food Exchange', 'Bring a dish from home, take home a story. Potluck on the mess lawn.', 3, '19:00', 'Mess Lawn', 30, { tags: ['Food', 'Culture'], cultural: true, emoji: '🍲' });
    act('musicnight', 'meera', 'event', 'Cultural', 'Culture', 'Music Night', 'Folk to K-Pop — an open stage for music from everywhere.', 5, '18:30', 'OAT', 50, { tags: ['Music', 'Culture'], cultural: true, emoji: '🎶' });
    act('tradgames', 'karan', 'event', 'Cultural', 'Culture', 'Traditional Games', 'Kho-kho, gilli-danda, pallanguzhi and more.', 9, '17:00', 'Sports Ground', 24, { tags: ['Games', 'Culture'], cultural: true, emoji: '🪁' });
    act('langex', 'aiko', 'event', 'Cultural', 'Culture', 'Language Exchange', 'Rotating tables: Japanese, Korean, Tamil, Bengali, Hindi. 10 minutes each.', 4, '18:00', 'Library', 20, { tags: ['Language', 'Culture'], cultural: true, emoji: '🗣️' });
    act('dressday', 'riya', 'event', 'Cultural', 'Culture', 'Cultural Dress Day', 'Wear your traditional outfit and join the campus photo walk.', 14, '16:00', 'Campus', 60, { tags: ['Culture', 'Festivals', 'Photography'], cultural: true, emoji: '👘' });
    act('culturaljam', 'lalit', 'event', 'Cultural', 'Culture', 'Cultural Jam', 'Jam session mixing Bihu, Bhangra and Carnatic rhythms.', 10, '19:00', 'OAT', 25, { tags: ['Music', 'Dance', 'Culture'], cultural: true, emoji: '🥁' });
    act('diwali', 'neha', 'event', 'Cultural', 'Culture', 'Festival Celebration: Diwali', 'Rangoli, diyas and sweets — everyone welcome.', 11, '18:00', 'Campus', 80, { tags: ['Festivals', 'Culture'], cultural: true, emoji: '🪔' });
    act('movienight', 'minji', 'event', 'Cultural', 'Culture', 'Movie Night: Spirited Away', 'Japanese animation classic with subtitles, popcorn provided.', 7, '21:00', 'Campus', 40, { tags: ['Movies', 'Anime', 'Culture'], cultural: true, emoji: '🎬' });

    // Teach Me Something
    act('bengalicook', 'meerad', 'teach', 'Cultural', 'Culture', 'Bengali Cooking', 'Learn to make mishti doi and aloo posto in the hostel pantry.', 4, '17:00', 'Campus', 6, { tags: ['Food', 'Bengali'], cultural: true, emoji: '🍛' });
    act('tamil', 'sneha', 'teach', 'Cultural', 'Culture', 'Tamil Phrases', 'Twenty everyday Tamil phrases in thirty minutes.', 2, '18:00', 'Online', 15, { tags: ['Language', 'Tamil'], cultural: true, emoji: '🗣️' });
    act('garba', 'riya', 'teach', 'Cultural', 'Culture', 'Garba Steps', 'Basic Garba and Dandiya steps — no experience needed.', 6, '19:00', 'OAT', 20, { tags: ['Dance', 'Gujarati'], cultural: true, emoji: '💃' });
    act('punjabimusic', 'karan', 'teach', 'Cultural', 'Culture', 'Punjabi Music', 'Dhol basics and the story behind classic Punjabi folk songs.', 8, '18:30', 'Campus', 10, { tags: ['Music', 'Punjabi'], cultural: true, emoji: '🥁' });
    act('koreanuni', 'minji', 'teach', 'Cultural', 'Culture', 'Korean University Culture', 'MT trips, hoesik and study cafés — campus life in Seoul.', 5, '17:00', 'Online', 25, { tags: ['Korean', 'Culture'], cultural: true, emoji: '🇰🇷' });
    act('bihu', 'lalit', 'teach', 'Cultural', 'Culture', 'Assamese Festival: Bihu', 'Why Assam celebrates three Bihus, plus a few dance steps.', 9, '18:00', 'Campus', 20, { tags: ['Festivals', 'Assamese'], cultural: true, emoji: '🌾' });
    act('japanese', 'aiko', 'teach', 'Cultural', 'Culture', 'Japanese for Beginners', 'Hiragana and self-introductions in one evening.', 3, '19:30', 'Library', 12, { tags: ['Language', 'Japanese'], cultural: true, emoji: '⛩️' });

    // Past (completed) events
    act('pastjam', 'lalit', 'event', 'Cultural', 'Culture', 'Cultural Jam', 'Our first cross-region jam session.', -40, '19:00', 'OAT', 25, { tags: ['Music', 'Culture'], cultural: true, emoji: '🥁' });
    act('pastfootball', 'karan', 'sports', 'Sports', 'Sports', 'Inter-Department Football Match', 'ECE vs Mechanical friendly.', -20, '17:00', 'Sports Ground', 22, { tags: ['Football'], emoji: '⚽' });
    act('pastfood', 'ananya', 'event', 'Cultural', 'Culture', 'South Indian Food Exchange', 'Dosa, appam and pongal on the mess lawn.', -12, '19:00', 'Mess Lawn', 30, { tags: ['Food', 'Culture'], cultural: true, emoji: '🍲' });
    act('paststudy', 'ananya', 'study', 'Study', 'Study', 'DBMS Study Session', 'End-sem revision marathon.', -8, '18:00', 'Library', 8, { course: 'DBMS', tags: ['DBMS'], emoji: '📚' });
    act('pastphoto', 'rohan', 'event', 'Hobby', 'Hobbies', 'Photography Basics Workshop', 'Exposure triangle and composition basics.', -30, '16:00', 'LH-2', 20, { tags: ['Photography'], emoji: '📷' });
    act('pastkorea', 'minji', 'event', 'Cultural', 'Culture', 'Korean Culture Talk', 'Hallyu beyond the hype.', -50, '18:00', 'Online', 40, { tags: ['Korean', 'Culture'], cultural: true, emoji: '🇰🇷' });

    const member = (key, users, status = 'accepted') => users.forEach((u) => q.run('INSERT OR IGNORE INTO activity_members (activity_id, user_id, status, message) VALUES (?, ?, ?, ?)',
      aid[key], id[u], status, status === 'pending' ? 'Would love to contribute — I have relevant experience!' : null));

    // Arjun's project: 8 applications, 3 accepted, 1 opening
    member('traffic', ['kabir', 'priya', 'muskan']);
    member('traffic', ['rohan', 'aiko', 'rahul'], 'pending');
    member('traffic', ['neha', 'sneha'], 'rejected');
    // Arjun's applications
    member('interiit', ['arjun'], 'pending');
    member('aiws', ['arjun', 'sneha', 'rohan', 'meerad', 'aiko']);
    member('photowalk', ['arjun'], 'rejected');
    member('photowalk', ['riya', 'priya', 'tenzin', 'ishita']);
    member('football', ['arjun', 'kabir', 'arjunn', 'rahul', 'dev']);
    member('foodex', ['arjun', 'ananya', 'meerad', 'lalit', 'aiko', 'minji']);
    member('dsp', ['meera', 'meerad', 'aiko']);
    member('os', ['rohan', 'minji'], 'accepted');
    member('ml', ['priya', 'neha', 'sneha']);
    member('musicnight', ['riya', 'karan', 'minji', 'lalit']);
    member('langex', ['minji', 'sneha', 'meerad', 'ananya']);
    member('grid', ['lalit']);
    member('eventapp', ['rohan']);
    member('boardgames', ['rahul', 'arjunn']);
    member('cycling', ['dev', 'lalit']);
    member('dressday', ['meera', 'ishita', 'aiko', 'neha']);
    member('culturaljam', ['karan', 'riya', 'sneha']);
    member('garba', ['ananya', 'minji', 'aiko']);
    member('japanese', ['sneha', 'rahul', 'meerad']);
    // Past participation
    member('pastjam', ['arjun', 'riya', 'karan', 'sneha', 'meera']);
    member('pastfootball', ['arjun', 'kabir', 'arjunn', 'dev', 'rahul']);
    member('pastfood', ['arjun', 'sneha', 'arjunn', 'aiko', 'neha']);
    member('paststudy', ['arjun', 'sneha', 'rohan']);
    member('pastphoto', ['arjun', 'riya', 'dev', 'tenzin']);
    member('pastkorea', ['arjun', 'meera', 'aiko']);

    // Post-event survey responses → testimonials
    const fb = (key, user, rating, met, learned, cultural, again, comment) => q.run(`INSERT INTO feedback (activity_id, user_id, rating, met_new, learned_new, cultural, again, comment, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, aid[key], id[user], rating, met, learned, cultural, again, comment, rating >= 4 && comment.length >= 15 ? 1 : 0);
    fb('pastjam', 'riya', 5, 1, 1, 1, 1, 'Jamming Bihu beats with Garba rhythms was magical. I made three new friends from the Northeast!');
    fb('pastjam', 'karan', 4, 1, 1, 1, 1, 'Never thought dhol and Carnatic percussion could blend so well. Already planning the next one.');
    fb('pastfood', 'aiko', 5, 1, 1, 1, 1, 'I tasted appam for the first time and learnt how Onam sadya is served. Best evening of my exchange so far.');
    fb('pastfood', 'neha', 5, 1, 0, 1, 1, 'Swapped my Litti Chokha recipe for a perfect dosa batter tip. The cultural exchange was so warm.');
    fb('pastfootball', 'kabir', 4, 1, 0, 0, 1, 'Played alongside ECE folks I had never spoken to before. Great energy and a great way to meet people.');
    fb('paststudy', 'sneha', 4, 0, 1, 0, 1, 'Study group made normalization finally click. Way more productive than revising alone.');
    fb('pastkorea', 'meera', 5, 1, 1, 1, 1, 'Learnt about Korean university culture straight from Minji — and picked up my first Hangul phrases!');
    fb('pastphoto', 'tenzin', 5, 1, 1, 0, 1, 'As a fresher this was the perfect project experience: met seniors, learnt composition and found my club.');
    fb('pastphoto', 'arjun', 4, 1, 1, 0, 1, 'Learnt more about manual mode in two hours than in two years of clicking on my phone.');

    // Posts
    const post = (user, hours, topic, content, extra = {}) => {
      const info = q.run(`INSERT INTO posts (user_id, kind, type, topic, story_category, content, images, link_url, meta, tags, community_id, views, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id[user], extra.kind || 'post', extra.type || (extra.images?.length ? 'image' : 'text'), topic, extra.story || null, content,
      J(extra.images || []), extra.link || null, J(extra.meta || {}), J(extra.tags || []), extra.community ? cid[extra.community] : null,
      Math.floor(rand() * 300) + 20, hoursAgo(hours));
      return Number(info.lastInsertRowid);
    };
    const pid = [];
    pid.push(post('riya', 2, 'Arts', 'Just finished the photography walk! Met some amazing people from different departments and got some beautiful shots. ✨ Here are a few from the event!', { images: [img('walk1'), img('walk2'), img('walk3')], tags: ['Photography'] }));
    pid.push(post('kabir', 4, 'Academics', 'Working on the SDR lab today. Anyone interested in discussing the reports together? Let’s form a small group!', { type: 'discussion', tags: ['DSP', 'Electronics'] }));
    const notes = writeDemoPdf('systems-design-notes.pdf', ['System Design Basics', '1. Load balancers and horizontal scaling', '2. Caching: CDN, Redis, cache invalidation', '3. Databases: SQL vs NoSQL, sharding, replication', '4. Queues and async processing', '5. Back-of-the-envelope estimation', 'Shared by Rohan Gupta on Campus Connect']);
    pid.push(post('rohan', 4.5, 'Tech', 'Sharing some notes on system design basics, might be useful for interviews and projects.', { meta: { file: notes }, tags: ['SystemDesign', 'Internship', 'CP'] }));
    pid.push(post('muskan', 5, 'Tech', 'Hackathon team formation! Looking for one frontend dev and one designer for a campus hackathon. #Hackathon #Team #WebDev', { type: 'project', meta: { title: 'Campus Events App', lookingFor: ['Frontend', 'Design'], skills: ['React', 'Figma'], teamSize: '2/4' }, tags: ['Hackathon', 'React'] }));
    pid.push(post('arjunn', 6, 'Sports', 'Does anyone know a good place on campus to practice badminton in the evenings?', { type: 'discussion', tags: ['Badminton', 'Sports'] }));
    pid.push(post('meera', 7, 'Tech', 'Finally got OFDM working on the Pluto SDR! Constellation after equalization looks clean. 📡', { images: [img('sdr')], tags: ['DSP', 'Electronics'] }));
    pid.push(post('ishita', 3, 'Culture', 'Onam celebration at SAC! The food, performances and energy were amazing. Here are some glimpses!', { images: [img('onam1'), img('onam2'), img('onam3')], tags: ['Festivals', 'Onam'] }));
    pid.push(post('rahul', 5, 'Culture', 'Language exchange session was so much fun today! Learnt a few basic phrases in Malayalam. Looking forward to the next one!', { tags: ['Language'] }));
    pid.push(post('neha', 12, 'Culture', 'Sharing some moments from the North East cultural evening. Such incredible performances and food! ✨', { images: [img('ne1'), img('ne2')], tags: ['Culture', 'Festivals'] }));
    pid.push(post('ananya', 9, 'Academics', 'DSA tip: when a problem says “minimum number of operations” on a grid, think BFS before DP. Saved me in today’s contest. #DSA #CP', { tags: ['DSA', 'CP'] }));
    pid.push(post('kabir', 20, 'Tech', 'Our line-follower bot finally takes corners without overshooting. PID tuning is an art. 🤖', { images: [img('robot')], tags: ['Robotics', 'Arduino'], community: 'AI/ML Club' }));
    pid.push(post('sneha', 26, 'Academics', 'Summarised the transformer paper for the ML reading group — slides linked below.', { type: 'link', link: 'https://arxiv.org/abs/1706.03762', tags: ['ML', 'AI/ML', 'Research'], community: 'AI/ML Club' }));
    pid.push(post('karan', 30, 'Sports', 'Football 5-a-side this Friday at the sports ground. We need two more players!', { type: 'event', meta: { title: 'Football 5-a-side', date: dayOffset(1), time: '17:30', location: 'Sports Ground' }, tags: ['Football'] }));
    pid.push(post('dev', 36, 'Arts', 'Sunrise from the cycling loop this morning. Worth waking up at 5:30. 🌅', { images: [img('sunrise')], tags: ['Photography', 'Cycling'] }));
    pid.push(post('rohan', 40, 'Tech', 'Internship season tips: start applying in August, keep a project you can talk about for 20 minutes, practise mock interviews with friends. #Internship', { type: 'discussion', tags: ['Internship', 'CP'] }));
    pid.push(post('meerad', 44, 'Academics', 'Anyone want to co-author a short paper on speech enhancement with DSP + ML? Looking for 2 collaborators.', { type: 'project', meta: { title: 'Speech Enhancement Paper', lookingFor: ['ML', 'DSP'], skills: ['Python', 'MATLAB'], teamSize: '1/3' }, tags: ['Research', 'DSP', 'ML'] }));
    pid.push(post('priya', 50, 'Arts', 'Old havelis of Shekhawati — shot during the semester break.', { images: [img('haveli1'), img('haveli2')], tags: ['Photography', 'Rajasthan'], community: 'Photography Club' }));
    pid.push(post('minji', 60, 'Culture', 'Should we start a weekly K-drama + Bollywood double feature? 🍿', { type: 'discussion', tags: ['Movies', 'Korean'] }));
    pid.push(post('lalit', 70, 'Events', 'Cultural Jam is back! Bring your instrument or just your voice.', { type: 'event', meta: { title: 'Cultural Jam', date: dayOffset(10), time: '19:00', location: 'OAT' }, tags: ['Music', 'Culture'] }));
    pid.push(post('neha', 3.2, 'Life@Campus', 'Opinion: Should we have more open mics on campus? I feel there’s so much talent here beyond just tech!', { type: 'poll', meta: { poll: { options: ['Yes, every week!', 'Once a month is enough', 'Only during fests'] } }, tags: ['Music'] }));
    pid.push(post('karan', 26, 'Politics', 'Student council elections are next week. What should the new council prioritise — mess food, hostel Wi-Fi or more cultural funding? Drop your thoughts 👇', { type: 'discussion', tags: ['Elections'] }));
    pid.push(post('muskan', 80, 'Memes', 'When the code compiles on the first try during the hackathon demo 😎', { tags: ['Hackathon'] }));
    pid.push(post('aiko', 90, 'Life@Campus', 'One month in India: the chai, the warmth and the cricket obsession. Thank you everyone for making me feel at home!', { tags: ['Culture'] }));
    pid.push(post('tenzin', 100, 'Sports', 'Morning cycling group is growing — 8 riders last Sunday!', { images: [img('cycle')], tags: ['Cycling'], community: 'Cycling Group' }));

    // Cultural cards / mini stories
    const story = (user, hours, cat, content, image, tags) => pid.push(post(user, hours, 'Culture', content, { kind: 'story', story: cat, images: image ? [img(image)] : [], tags }));
    story('ananya', 8, 'Food From My Home', 'Appam with stew is Kerala’s answer to comfort food — lacy edges, soft centre and coconut-milk stew for Sunday breakfasts.', 'appam', ['Food', 'Kerala']);
    story('karan', 14, 'Festival Stories', 'Lohri nights: bonfires, popcorn, rewri and everyone singing “Sunder Mundriye” around the fire.', 'lohri', ['Festivals', 'Punjab']);
    story('sneha', 22, 'Did You Know', 'Did you know? Pongal is celebrated over four days, and the dish is named after the festival — “pongal” means “to boil over”.', 'pongal', ['Festivals', 'Tamil Nadu']);
    story('priya', 30, 'Traditional Games', 'Gilli-danda was our summer-vacation cricket in Rajasthan. Two sticks, endless arguments about whether it was out.', 'gilli', ['Games', 'Rajasthan']);
    story('meerad', 34, 'Local Music', 'Rabindrasangeet is the soundtrack of every Bengali home — Tagore wrote over 2,000 songs!', 'tagore', ['Music', 'Bengal']);
    story('lalit', 48, 'Regional Traditions', 'The Gamosa — a white cloth with red borders — is gifted in Assam as a mark of respect. You’ll see it at every Bihu.', 'gamosa', ['Traditions', 'Assam']);
    story('aiko', 56, 'Festival Stories', 'Hanami: we picnic under cherry blossoms every spring. The blooms last only a week, so everyone rushes out!', 'sakura', ['Festivals', 'Japan']);
    story('minji', 66, 'Food From My Home', 'Kimchi-making (kimjang) is a family event every November — dozens of cabbages, all hands on deck.', 'kimchi', ['Food', 'Korea']);
    story('tenzin', 76, 'Food From My Home', 'Momos in Sikkim come with a fiery tomato-chilli achar. Thukpa on a cold evening is unbeatable.', 'momos', ['Food', 'Sikkim']);
    story('neha', 86, 'Regional Traditions', 'Chhath Puja: offering prayers to the setting and rising sun from the riverbank. The thekua is the best part!', 'chhath', ['Festivals', 'Bihar']);

    // Upvotes, saves and comments
    const userKeys = Object.keys(id);
    for (const p of pid) {
      for (const u of pick(userKeys, Math.floor(rand() * 12) + 2)) q.run('INSERT OR IGNORE INTO post_upvotes (post_id, user_id) VALUES (?, ?)', p, id[u]);
    }
    const commentsText = ['These photos are amazing! Can I join the next one?', 'I’m from a different department but would love to join next time!',
      'Lovely shots! Which camera did you use?', 'Count me in!', 'This is so helpful, thank you!', 'Saving this for later 🙌', 'Never knew this — thanks for sharing!',
      'We should do this every month.', 'Let’s discuss after class.', 'Would love to learn more about this.'];
    for (const p of pid) {
      for (const u of pick(userKeys, Math.floor(rand() * 4))) q.run('INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)', p, id[u], commentsText[Math.floor(rand() * commentsText.length)], hoursAgo(rand() * 10));
    }
    // Poll votes, comment replies and comment likes
    const pollId = q.get("SELECT id FROM posts WHERE type = 'poll'").id;
    for (const [i, u] of userKeys.entries()) if (i % 3 !== 0) q.run('INSERT INTO poll_votes (post_id, user_id, option) VALUES (?, ?, ?)', pollId, id[u], i % 5 === 0 ? 2 : i % 2);
    for (const c of q.all('SELECT id, post_id, user_id FROM comments')) {
      for (const u of pick(userKeys, Math.floor(rand() * 8))) q.run('INSERT OR IGNORE INTO comment_likes (comment_id, user_id) VALUES (?, ?)', c.id, id[u]);
      if (rand() < 0.3) {
        const author = q.get('SELECT user_id FROM posts WHERE id = ?', c.post_id).user_id;
        if (author !== c.user_id) q.run('INSERT INTO comments (post_id, user_id, parent_id, content, created_at) VALUES (?, ?, ?, ?, ?)', c.post_id, author, c.id, ['Thank you! 😊', 'Yes, definitely — join us next time!', 'Glad it helped!', 'Will share more soon.'][Math.floor(rand() * 4)], hoursAgo(rand() * 2));
      }
    }
    q.run('INSERT INTO post_saves (post_id, user_id) VALUES (?, ?)', pid[2], id.arjun);
    q.run('INSERT INTO searches (user_id, query) VALUES (?, ?)', id.arjun, 'hackathon');

    // Chats
    const dm = (a, b, msgs) => {
      const conv = Number(q.run("INSERT INTO conversations (type) VALUES ('dm')").lastInsertRowid);
      q.run('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', conv, id[a], conv, id[b]);
      addMessages(conv, msgs);
      return conv;
    };
    const addMessages = (conv, msgs) => {
      let last = 0;
      for (const [who, text, h, image] of msgs) {
        last = Number(q.run('INSERT INTO messages (conversation_id, sender_id, content, image, created_at) VALUES (?, ?, ?, ?, ?)', conv, id[who], text, image || null, hoursAgo(h)).lastInsertRowid);
      }
      return last;
    };
    const markRead = (conv, users) => users.forEach((u) => q.run('UPDATE conversation_members SET last_read_id = (SELECT MAX(id) FROM messages WHERE conversation_id = ?) WHERE conversation_id = ? AND user_id = ?', conv, conv, id[u]));

    const riyaDm = dm('arjun', 'riya', [
      ['riya', 'Hey! Are you coming to the cultural fest tomorrow?', 3.1], ['arjun', 'Yes! Definitely. Are you going with your group?', 3.0],
      ['riya', 'Yeah, a few of us are going. Want to join?', 2.9], ['arjun', 'Sure! What time are you meeting?', 2.8],
      ['riya', 'Around 4 PM near the main gate.', 2.7], ['riya', 'Let’s meet tomorrow at the library! I’ll share the exact location.', 2.6]]);
    markRead(riyaDm, ['riya']);
    const kabirDm = dm('arjun', 'kabir', [['arjun', 'Can you share the ML notes from today?', 5], ['kabir', 'Yeah sure, I’ll share the notes.', 4.8]]);
    markRead(kabirDm, ['kabir']);
    const ananyaDm = dm('arjun', 'ananya', [['ananya', 'Do you want to join the study group?', 8], ['arjun', 'Which one — OS?', 7.9], ['ananya', 'Yes, Thursday 7 PM at the library.', 7.8], ['arjun', 'I’m in 👍', 7.7]]);
    markRead(ananyaDm, ['arjun', 'ananya']);
    const devDm = dm('arjun', 'dev', [['dev', 'The event was really good!', 26], ['arjun', 'Agreed, let’s do the photowalk next.', 25]]);
    markRead(devDm, ['arjun', 'dev']);
    const meeraDm = dm('arjun', 'meera', [['arjun', 'Send me the photos when you can.', 30], ['meera', 'Uploading tonight!', 29]]);
    markRead(meeraDm, ['arjun', 'meera']);
    const rohanDm = dm('arjun', 'rohan', [['rohan', 'Let’s plan the project discussion.', 90], ['arjun', 'Sure, Saturday works.', 89]]);
    markRead(rohanDm, ['arjun', 'rohan']);

    // Community chats
    for (const [name] of COMMUNITIES) {
      const conv = communityConversation(cid[name]);
      for (const m of q.all('SELECT user_id FROM community_members WHERE community_id = ?', cid[name])) {
        q.run('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', conv, m.user_id);
      }
    }
    const commMsgs = {
      'Cultural Exchange': [['ananya', 'Here are some pictures from the Onam celebration yesterday! Such a great experience 🎉', 6, img('onam1')],
        ['rohan', 'Wow! The decorations look amazing. Would love to join next time.', 5.8], ['meera', 'Does anyone have more information about the upcoming food exchange event?', 5.6],
        ['kabir', 'Yes! I think it’s on Saturday. Will share the poster here soon.', 5.4], ['aiko', 'Can we also plan a cultural dress day this semester?', 1]],
      'AI/ML Club': [['sneha', 'Uploaded the transformer slides to the drive.', 12], ['kabir', 'Here are the resources for this week’s reading group.', 4]],
      'Photography Club': [['dev', 'Golden hour today was unreal.', 30], ['rohan', 'Meetup this Saturday at 5?', 20]],
      'Football Enthusiasts': [['karan', 'Who’s up for a match this week?', 22], ['arjunn', 'Me! Friday works.', 21]],
      'North Indian Culture': [['karan', 'Lohri bonfire planning thread 🔥', 50], ['priya', 'Sharing some pictures from Teej.', 48, img('teej')]],
    };
    for (const [name, msgs] of Object.entries(commMsgs)) {
      const conv = communityConversation(cid[name]);
      addMessages(conv, msgs);
      const readers = q.all('SELECT user_id FROM conversation_members WHERE conversation_id = ?', conv).map((m) => m.user_id).filter((u) => u !== id.arjun);
      readers.forEach((u) => q.run('UPDATE conversation_members SET last_read_id = (SELECT MAX(id) FROM messages WHERE conversation_id = ?) WHERE conversation_id = ? AND user_id = ?', conv, conv, u));
    }

    // Group chats for every activity with its accepted members
    for (const a of q.all('SELECT id FROM activities')) {
      const conv = activityConversation(a.id);
      for (const m of q.all("SELECT user_id FROM activity_members WHERE activity_id = ? AND status = 'accepted'", a.id)) {
        q.run('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', conv, m.user_id);
      }
    }
    const groupMsgs = {
      traffic: [['arjun', 'Welcome to the team! Let’s meet Saturday to scope the MVP.', 30], ['kabir', 'I can handle the YOLO model.', 29], ['priya', 'I’ll take the Arduino + camera mount.', 10], ['muskan', 'Dashboard mockups coming tonight.', 3]],
      foodex: [['neha', 'Please drop the dish you’re bringing here so we avoid duplicates!', 20], ['ananya', 'Appam + stew 🥥', 18], ['aiko', 'Onigiri!', 6]],
      football: [['karan', 'Match this Friday?', 9], ['arjunn', 'Bringing an extra ball.', 2]],
      aiws: [['kabir', 'Please install PyTorch before the session 🙏', 15]],
    };
    for (const [key, msgs] of Object.entries(groupMsgs)) {
      const conv = activityConversation(aid[key]);
      addMessages(conv, msgs);
      markRead(conv, userKeys.filter((u) => u !== 'arjun'));
    }

    // Buddy preferences for complementary matching
    q.run("INSERT INTO buddy_prefs (user_id, mode, topic) VALUES (?, 'Teach', 'Language')", id.aiko);
    q.run("INSERT INTO buddy_prefs (user_id, mode, topic) VALUES (?, 'Teach', 'Food')", id.ananya);
    q.run("INSERT INTO buddy_prefs (user_id, mode, topic) VALUES (?, 'Learn', 'Language')", id.minji);

    // Notifications for the demo user
    q.run('INSERT INTO notifications (user_id, type, text, link) VALUES (?, ?, ?, ?)', id.arjun, 'friend_request', 'Priya Nair sent you a friend request', '/personal?tab=requests');
    q.run('INSERT INTO notifications (user_id, type, text, link) VALUES (?, ?, ?, ?)', id.arjun, 'application', 'Rohan Gupta applied to “AI-based Traffic Detection”', `/personal?manage=${aid.traffic}`);
    q.run('INSERT INTO notifications (user_id, type, text, link, is_read) VALUES (?, ?, ?, ?, 1)', id.arjun, 'feedback', '“Cultural Jam” is complete – tell us how it went!', `/personal?feedback=${aid.pastjam}`);

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { users: USERS.length };
}

export async function seedIfEmpty() {
  if (!q.get('SELECT 1 FROM users LIMIT 1')) {
    seed();
    console.log(`Seeded demo data. Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  }
}

// `node src/seed.js` → reset and reseed.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Drop and recreate tables in place, so this also works while the server holds the file open.
  const db = openDb(path.join(DATA_DIR, 'campus.db'));
  db.exec('PRAGMA foreign_keys = OFF');
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) db.exec(`DROP TABLE "${name}"`);
  db.exec('PRAGMA foreign_keys = ON');
  openDb(path.join(DATA_DIR, 'campus.db'));
  seed();
  console.log(`Database reset. Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}
