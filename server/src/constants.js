// Single source of truth for every option list in the app. The client loads these from /api/meta.

// IIT Roorkee addresses carry the department as a subdomain, e.g. khushi@ece.iitr.ac.in. Any department
// subdomain is accepted (and the bare iitr.ac.in domain).
export const ALLOWED_EMAIL_SUFFIX = 'iitr.ac.in';
export const ALLOWED_EMAIL_SUFFIXES = ['iitr.ac.in'];

export function isCollegeEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  const m = e.match(/^[^\s@]+@([a-z0-9.-]+)$/);
  if (!m) return false;
  const domain = m[1];
  return ALLOWED_EMAIL_SUFFIXES.some((s) => domain === s || domain.endsWith('.' + s));
}

// The 23 academic departments of IIT Roorkee (iitr.ac.in/Departments). `value` is the short label shown
// across the app; `codes` are email subdomains that pre-select the department at signup (the first one is
// used to build seeded/migrated addresses).
export const IITR_DEPARTMENTS = [
  { value: 'Applied Maths', name: 'Applied Mathematics and Scientific Computing', codes: ['asc', 'amsc'] },
  { value: 'Architecture', name: 'Architecture and Planning', codes: ['ar', 'arch', 'arcd'] },
  { value: 'Biosciences', name: 'Biosciences and Bioengineering', codes: ['bt', 'bsbe', 'bio'] },
  { value: 'Chemical', name: 'Chemical Engineering', codes: ['ch', 'che', 'chem'] },
  { value: 'Chemistry', name: 'Chemistry', codes: ['cy'] },
  { value: 'Civil', name: 'Civil Engineering', codes: ['ce', 'civil'] },
  { value: 'CSE', name: 'Computer Science and Engineering', codes: ['cse', 'cs'] },
  { value: 'Design', name: 'Design', codes: ['des', 'design', 'dod'] },
  { value: 'Earth Sciences', name: 'Earth Sciences', codes: ['es', 'esd'] },
  { value: 'Earthquake', name: 'Earthquake Engineering', codes: ['eq', 'eqd'] },
  { value: 'Electrical', name: 'Electrical Engineering', codes: ['ee'] },
  { value: 'ECE', name: 'Electronics and Communication Engineering', codes: ['ece', 'ec'] },
  { value: 'HSS', name: 'Humanities and Social Sciences', codes: ['hs', 'hss'] },
  { value: 'Hydro & Renewable', name: 'Hydro and Renewable Energy', codes: ['hre', 'hred', 'ahec'] },
  { value: 'Hydrology', name: 'Hydrology', codes: ['hy', 'hyd'] },
  { value: 'Management', name: 'Management Studies', codes: ['ms', 'doms', 'mba'] },
  { value: 'Mathematics', name: 'Mathematics', codes: ['ma', 'maths'] },
  { value: 'Mechanical', name: 'Mechanical and Industrial Engineering', codes: ['me', 'mied', 'ie'] },
  { value: 'Metallurgy', name: 'Metallurgical and Materials Engineering', codes: ['mt', 'mmed', 'meta'] },
  { value: 'Paper Tech', name: 'Paper Technology', codes: ['pt', 'ppt'] },
  { value: 'Physics', name: 'Physics', codes: ['ph'] },
  { value: 'Polymer', name: 'Polymer and Process Engineering', codes: ['pe', 'ppe'] },
  { value: 'Water Resources', name: 'Water Resources Development and Management', codes: ['wr', 'wrd', 'wrdm'] },
];

/** Builds an IITR address from a local part and a department label: ("arjunm", "CSE") → arjunm@cse.iitr.ac.in. */
export function collegeEmail(local, department) {
  const code = IITR_DEPARTMENTS.find((d) => d.value === department)?.codes[0];
  return `${local}@${code ? `${code}.` : ''}${ALLOWED_EMAIL_SUFFIX}`;
}

// Region -> zone (used for "different background" and Connect: Regional / National / International)
export const REGIONS = {
  'Andhra Pradesh': 'South', Assam: 'Northeast', Bihar: 'East', Chhattisgarh: 'Central', Delhi: 'North',
  Goa: 'West', Gujarat: 'West', Haryana: 'North', 'Himachal Pradesh': 'North', Jharkhand: 'East',
  Karnataka: 'South', Kerala: 'South', 'Madhya Pradesh': 'Central', Maharashtra: 'West', Manipur: 'Northeast',
  Meghalaya: 'Northeast', Mizoram: 'Northeast', Nagaland: 'Northeast', Odisha: 'East', Punjab: 'North',
  Rajasthan: 'North', Sikkim: 'Northeast', 'Tamil Nadu': 'South', Telangana: 'South', Tripura: 'Northeast',
  'Uttar Pradesh': 'North', Uttarakhand: 'North', 'West Bengal': 'East', 'Jammu & Kashmir': 'North',
  'Arunachal Pradesh': 'Northeast',
  Japan: 'International', 'South Korea': 'International', Nepal: 'International', Bangladesh: 'International',
  France: 'International', Germany: 'International', USA: 'International', 'Sri Lanka': 'International',
};

export const zoneOf = (region) => REGIONS[region] || (region ? 'International' : null);

export const OPTIONS = {
  departments: IITR_DEPARTMENTS.map((d) => d.value),
  departmentInfo: IITR_DEPARTMENTS,
  years: ['1st', '2nd', '3rd', '4th'],
  courses: ['DSP', 'OS', 'DBMS', 'ML', 'Networks', 'DSA', 'Mathematics'],
  skills: ['Python', 'C++', 'MATLAB', 'Verilog', 'React', 'OpenCV', 'Arduino', 'Figma'],
  hobbies: ['Photography', 'Sports', 'Robotics', 'Music', 'Reading', 'Gaming', 'Football', 'Cycling'],
  interests: ['AI/ML', 'CP', 'Electronics', 'Research', 'Finance', 'Robotics'],
  clubs: ['Robotics', 'Programming', 'Cultural', 'Sports', 'Photography'],
  regions: Object.keys(REGIONS),
  languages: ['Hindi', 'English', 'Malayalam', 'Tamil', 'Bengali', 'Telugu', 'Kannada', 'Marathi',
    'Gujarati', 'Punjabi', 'Assamese', 'Odia', 'Urdu', 'Japanese', 'Korean', 'French', 'German', 'Spanish'],
  languagesInterested: ['Bengali', 'Japanese', 'French', 'Tamil', 'Korean', 'Spanish', 'Malayalam', 'German'],
  culturalInterests: ['Food', 'Festivals', 'Music', 'Dance', 'Art'],
  foods: ['Litti Chokha', 'Dosa', 'Momos', 'Biryani', 'Dhokla', 'Appam', 'Sushi', 'Rasgulla'],
  festivals: ['Diwali', 'Onam', 'Bihu', 'Pongal', 'Holi', 'Durga Puja', 'Eid', 'Christmas'],
  musicArt: ['Folk', 'Classical', 'Bollywood', 'Anime', 'K-Pop', 'Indie'],
  availability: ['Morning', 'Afternoon', 'Evening'],
  postTypes: ['Text', 'Image', 'Link', 'Event', 'Project', 'Discussion', 'Poll'],
  // First seven show as feed tabs; the rest live under “More”.
  topics: ['Tech', 'Culture', 'Politics', 'Sports', 'Arts', 'Academics', 'Life@Campus', 'Events', 'Memes', 'Other'],
  storyCategories: ['Did You Know', 'Food From My Home', 'Festival Stories', 'Traditional Games', 'Local Music', 'Regional Traditions'],
  discoverCategories: ['Study', 'Projects', 'Sports', 'Events', 'Hobbies', 'Games', 'Culture'],
  eventTypes: ['Hobby', 'Sports', 'Study', 'Cultural', 'Project'],
  locations: ['Campus', 'Library', 'Sports Ground', 'Online'],
  levels: ['Beginner', 'Intermediate', 'Advanced'],
  groupSizes: ['2–4', '5–8', '8+'],
  timeSlots: ['Morning', 'Afternoon', 'Evening'],
  dateFilters: ['Today', 'Tomorrow', 'Weekend'],
  reportReasons: ['Harassment', 'Spam', 'Fake Profile', 'Offensive Content', 'Inappropriate Behaviour'],
  buddyModes: {
    Learn: ['Culture', 'Language', 'Food', 'Festivals'],
    Teach: ['Language', 'Food', 'Music', 'Traditions'],
    Experience: ['Food', 'Festivals', 'Games', 'Music'],
    Connect: ['Regional', 'National', 'International'],
  },
  communityCategories: ['Academic', 'Hobbies', 'Entertainment', 'Sports', 'Culture'],
};

export const ICEBREAKERS = [
  { topic: 'Favourite Food', question: 'What food reminds you of home?' },
  { topic: 'Important Festival', question: 'Which festival is the biggest celebration where you come from?' },
  { topic: 'Traditional Game', question: 'What traditional game did you play growing up?' },
  { topic: 'Local Language', question: 'Can you teach me one phrase in your local language?' },
  { topic: 'Childhood Tradition', question: 'What is a childhood tradition you still miss?' },
  { topic: 'Regional Music', question: 'Which song or music style instantly takes you back home?' },
  { topic: 'Favourite Food', question: 'If I visited your hometown, which dish must I try first?' },
  { topic: 'Important Festival', question: 'How does your family celebrate the new year?' },
];

// Map an activity time "HH:MM" to a slot.
export function slotOf(time) {
  if (!time) return null;
  const h = parseInt(time.split(':')[0], 10);
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
