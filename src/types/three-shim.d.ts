// Shim de types pour three.js : le paquet `three` ne fournit plus de définitions
// TypeScript depuis r150 (elles vivent dans @types/three). Cette déclaration
// "shorthand" rend tous les imports de 'three' typés `any` pour que tsc passe.
// Pour un vrai typage : `npm i -D @types/three` puis supprimer ce fichier.
declare module 'three';
