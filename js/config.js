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
    'Miplace Kassouf': {
        color: '#E17055',
        borderColor: '#D63031',
        logo: 'img/Miplace Kassouf.png'
    },
    'Miplace Prime': {
        color: '#2D3436',
        borderColor: '#000000',
        logo: 'img/MiPlace Prime.png'
    },
    'Miplace Honor': {
        color: '#0984E3',
        borderColor: '#0652DD',
        logo: 'img/MiPlace Honor.png'
    },
    'Miplace Realme': {
        color: '#FDCB6E',
        borderColor: '#F39C12',
        logo: 'img/Miplace Realme.png'
    },
    'Miplace Premium': {
        color: '#6C5CE7',
        borderColor: '#5A4FCF',
        logo: 'img/Miplace Premium.png'
    }
};

const allStoreNames = Object.keys(STORE_CONFIG);

const STORE_KEY_REVERSE = Object.entries(STORE_KEY_MAP).reduce(
    (acc, [key, value]) => ({ ...acc, [value]: key }),
    {}
);
