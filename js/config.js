/* ============================================
   STORE CONFIGURATION & DATA DICTIONARY
   Warm Editorial Luxury BI Design System
   ============================================ */

export const STORE_CONFIG = Object.freeze({
    'Miplace Honor': Object.freeze({
        shortName: 'Honor',
        target: 130,
        color: 'rgba(100, 148, 237, 0.10)',  // #6494ED fill (Cornflower Blue)
        borderColor: '#6494ED',
        logo: 'img/MiPlace Honor.png'
    }),
    'Miplace Kassouf': Object.freeze({
        shortName: 'Kassouf',
        target: 65,
        color: 'rgba(233, 116, 81, 0.10)',   // #E97451 fill (Burnt Sienna)
        borderColor: '#E97451',
        logo: 'img/Miplace Kassouf.png'
    }),
    'Miplace Realme': Object.freeze({
        shortName: 'Realme',
        target: 65,
        color: 'rgba(255, 191, 0, 0.10)',     // #FFBF00 fill (Amber)
        borderColor: '#FFBF00',
        logo: 'img/Miplace Realme.png'
    }),
    'Miplace Premium': Object.freeze({
        shortName: 'Premium',
        target: 65,
        color: 'rgba(147, 197, 114, 0.10)',  // #93C572 fill (Pastel Green)
        borderColor: '#93C572',
        logo: 'img/Miplace Premium.png'
    }),
    'Miplace Prime': Object.freeze({
        shortName: 'Prime',
        target: 65,
        color: 'rgba(54, 69, 79, 0.10)',      // #36454F fill (Charcoal)
        borderColor: '#36454F',
        logo: 'img/MiPlace Prime.png'
    })
});

export const allStoreNames = Object.freeze(Object.keys(STORE_CONFIG));
