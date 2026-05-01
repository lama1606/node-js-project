const ROOT_CATEGORY_NAMES = ['Men', 'Women'];

/** Allowed subcategories under Men / Women (stored lowercase). */
const ALLOWED_SUBCATEGORIES = [
    'tshirts', 'shirts', 'pants', 'tops', 'jackets', 'dresses',
    'bags', 'shoes', 'sweatshirts', 'accessories', 'other'
];

function canonicalSubcategoryName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().toLowerCase();
}

module.exports = {
    ROOT_CATEGORY_NAMES,
    ALLOWED_SUBCATEGORIES,
    canonicalSubcategoryName
};
