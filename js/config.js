const STORE_META = {
    'Miplace Honor': 130,
    'Miplace Kassouf': 65,
    'Miplace Prime': 65,
    'Miplace Realme': 65,
    'Miplace Premium': 65
};

const STORE_KEY_MAP = {
    'DOM PEDRO': 'Miplace Honor',
    'KASSOUF': 'Miplace Kassouf',
    'XV': 'Miplace Prime',
    'REALME': 'Miplace Realme',
    'PREMIUM': 'Miplace Premium'
};

const STORE_CONFIG = {
    'Miplace Kassouf': { color: '#F97316', borderColor: '#EA580C', logo: 'img/Miplace Kassouf.png' },
    'Miplace Prime': { color: '#334155', borderColor: '#0F172A', logo: 'img/Miplace Prime.png' },
    'Miplace Honor': { color: '#3B82F6', borderColor: '#2563EB', logo: 'img/Miplace Honor.png' },
    'Miplace Realme': { color: '#EAB308', borderColor: '#CA8A04', logo: 'img/Miplace Realme.png' },
    'Miplace Premium': { color: '#A855F7', borderColor: '#7C3AED', logo: 'img/Miplace Premium.png' }
};

const allStoreNames = Object.keys(STORE_CONFIG);

const STORE_KEY_REVERSE = Object.entries(STORE_KEY_MAP).reduce((acc, [k, v]) => (acc[v] = k, acc), {});
