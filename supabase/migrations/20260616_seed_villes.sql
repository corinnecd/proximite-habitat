-- Villes principales Île-de-France + Oise avec coordonnées GPS

-- 75 Paris
INSERT INTO zones_villes (departement_code, nom, code_postal, lat, lng) VALUES
  ('75', 'Paris 1er', '75001', 48.8602, 2.3477),
  ('75', 'Paris 2e', '75002', 48.8680, 2.3440),
  ('75', 'Paris 3e', '75003', 48.8638, 2.3612),
  ('75', 'Paris 4e', '75004', 48.8543, 2.3572),
  ('75', 'Paris 5e', '75005', 48.8462, 2.3496),
  ('75', 'Paris 6e', '75006', 48.8492, 2.3323),
  ('75', 'Paris 7e', '75007', 48.8566, 2.3117),
  ('75', 'Paris 8e', '75008', 48.8744, 2.3106),
  ('75', 'Paris 9e', '75009', 48.8769, 2.3372),
  ('75', 'Paris 10e', '75010', 48.8762, 2.3614),
  ('75', 'Paris 11e', '75011', 48.8593, 2.3816),
  ('75', 'Paris 12e', '75012', 48.8407, 2.3883),
  ('75', 'Paris 13e', '75013', 48.8323, 2.3559),
  ('75', 'Paris 14e', '75014', 48.8282, 2.3268),
  ('75', 'Paris 15e', '75015', 48.8421, 2.2990),
  ('75', 'Paris 16e', '75016', 48.8631, 2.2768),
  ('75', 'Paris 17e', '75017', 48.8850, 2.3090),
  ('75', 'Paris 18e', '75018', 48.8925, 2.3444),
  ('75', 'Paris 19e', '75019', 48.8849, 2.3822),
  ('75', 'Paris 20e', '75020', 48.8637, 2.3985)
ON CONFLICT (departement_code, nom, code_postal) DO NOTHING;

-- 77 Seine-et-Marne
INSERT INTO zones_villes (departement_code, nom, code_postal, lat, lng) VALUES
  ('77', 'Meaux', '77100', 48.9601, 2.8788),
  ('77', 'Chelles', '77500', 48.8830, 2.5930),
  ('77', 'Melun', '77000', 48.5394, 2.6553),
  ('77', 'Pontault-Combault', '77340', 48.8022, 2.6044),
  ('77', 'Savigny-le-Temple', '77176', 48.5848, 2.5833),
  ('77', 'Torcy', '77200', 48.8505, 2.6567),
  ('77', 'Roissy-en-Brie', '77680', 48.7922, 2.6500),
  ('77', 'Combs-la-Ville', '77380', 48.6647, 2.5564),
  ('77', 'Lagny-sur-Marne', '77400', 48.8728, 2.7117),
  ('77', 'Dammarie-les-Lys', '77190', 48.5178, 2.6364),
  ('77', 'Bussy-Saint-Georges', '77600', 48.8389, 2.6989),
  ('77', 'Fontainebleau', '77300', 48.4048, 2.7028),
  ('77', 'Ozoir-la-Ferrière', '77330', 48.7647, 2.6664),
  ('77', 'Montereau-Fault-Yonne', '77130', 48.3828, 2.9553),
  ('77', 'Provins', '77160', 48.5572, 3.2997)
ON CONFLICT (departement_code, nom, code_postal) DO NOTHING;

-- 78 Yvelines
INSERT INTO zones_villes (departement_code, nom, code_postal, lat, lng) VALUES
  ('78', 'Versailles', '78000', 48.8014, 2.1301),
  ('78', 'Sartrouville', '78500', 48.9394, 2.1597),
  ('78', 'Mantes-la-Jolie', '78200', 48.9906, 1.7167),
  ('78', 'Saint-Germain-en-Laye', '78100', 48.8986, 2.0938),
  ('78', 'Poissy', '78300', 48.9283, 2.0468),
  ('78', 'Conflans-Sainte-Honorine', '78700', 48.9997, 2.0953),
  ('78', 'Les Mureaux', '78130', 48.9886, 1.9167),
  ('78', 'Houilles', '78800', 48.9261, 2.1886),
  ('78', 'Plaisir', '78370', 48.8219, 1.9486),
  ('78', 'Chatou', '78400', 48.8878, 2.1572),
  ('78', 'Le Chesnay-Rocquencourt', '78150', 48.8231, 2.1278),
  ('78', 'Trappes', '78190', 48.7733, 2.0019),
  ('78', 'Rambouillet', '78120', 48.6439, 1.8311),
  ('78', 'Maisons-Laffitte', '78600', 48.9472, 2.1456),
  ('78', 'Montigny-le-Bretonneux', '78180', 48.7714, 2.0339)
ON CONFLICT (departement_code, nom, code_postal) DO NOTHING;

-- 91 Essonne
INSERT INTO zones_villes (departement_code, nom, code_postal, lat, lng) VALUES
  ('91', 'Évry-Courcouronnes', '91000', 48.6244, 2.4411),
  ('91', 'Corbeil-Essonnes', '91100', 48.6128, 2.4828),
  ('91', 'Massy', '91300', 48.7306, 2.2714),
  ('91', 'Savigny-sur-Orge', '91600', 48.6814, 2.3478),
  ('91', 'Sainte-Geneviève-des-Bois', '91700', 48.6353, 2.3269),
  ('91', 'Viry-Châtillon', '91170', 48.6722, 2.3722),
  ('91', 'Athis-Mons', '91200', 48.7056, 2.3917),
  ('91', 'Palaiseau', '91120', 48.7144, 2.2458),
  ('91', 'Yerres', '91330', 48.7139, 2.4928),
  ('91', 'Draveil', '91210', 48.6847, 2.4117),
  ('91', 'Brétigny-sur-Orge', '91220', 48.6106, 2.3067),
  ('91', 'Grigny', '91350', 48.6539, 2.3847),
  ('91', 'Ris-Orangis', '91130', 48.6517, 2.4139),
  ('91', 'Les Ulis', '91940', 48.6806, 2.1692),
  ('91', 'Étampes', '91150', 48.4347, 2.1614)
ON CONFLICT (departement_code, nom, code_postal) DO NOTHING;

-- 92 Hauts-de-Seine
INSERT INTO zones_villes (departement_code, nom, code_postal, lat, lng) VALUES
  ('92', 'Boulogne-Billancourt', '92100', 48.8354, 2.2411),
  ('92', 'Nanterre', '92000', 48.8922, 2.2067),
  ('92', 'Colombes', '92700', 48.9228, 2.2536),
  ('92', 'Asnières-sur-Seine', '92600', 48.9117, 2.2878),
  ('92', 'Courbevoie', '92400', 48.8966, 2.2567),
  ('92', 'Rueil-Malmaison', '92500', 48.8764, 2.1897),
  ('92', 'Issy-les-Moulineaux', '92130', 48.8236, 2.2742),
  ('92', 'Levallois-Perret', '92300', 48.8947, 2.2876),
  ('92', 'Antony', '92160', 48.7533, 2.2997),
  ('92', 'Neuilly-sur-Seine', '92200', 48.8847, 2.2691),
  ('92', 'Clamart', '92140', 48.8006, 2.2647),
  ('92', 'Montrouge', '92120', 48.8189, 2.3194),
  ('92', 'Meudon', '92190', 48.8117, 2.2350),
  ('92', 'Suresnes', '92150', 48.8689, 2.2286),
  ('92', 'Puteaux', '92800', 48.8847, 2.2389)
ON CONFLICT (departement_code, nom, code_postal) DO NOTHING;

-- 93 Seine-Saint-Denis
INSERT INTO zones_villes (departement_code, nom, code_postal, lat, lng) VALUES
  ('93', 'Saint-Denis', '93200', 48.9362, 2.3575),
  ('93', 'Montreuil', '93100', 48.8638, 2.4433),
  ('93', 'Aulnay-sous-Bois', '93600', 48.9322, 2.4975),
  ('93', 'Aubervilliers', '93300', 48.9147, 2.3828),
  ('93', 'Drancy', '93700', 48.9300, 2.4519),
  ('93', 'Noisy-le-Grand', '93160', 48.8472, 2.5631),
  ('93', 'Pantin', '93500', 48.8950, 2.4036),
  ('93', 'Bondy', '93140', 48.9025, 2.4833),
  ('93', 'Épinay-sur-Seine', '93800', 48.9539, 2.3264),
  ('93', 'Sevran', '93270', 48.9417, 2.5283),
  ('93', 'Livry-Gargan', '93190', 48.9189, 2.5336),
  ('93', 'Le Blanc-Mesnil', '93150', 48.9389, 2.4614),
  ('93', 'Bobigny', '93000', 48.9069, 2.4400),
  ('93', 'Saint-Ouen-sur-Seine', '93400', 48.9122, 2.3339),
  ('93', 'Rosny-sous-Bois', '93110', 48.8694, 2.4864)
ON CONFLICT (departement_code, nom, code_postal) DO NOTHING;

-- 94 Val-de-Marne
INSERT INTO zones_villes (departement_code, nom, code_postal, lat, lng) VALUES
  ('94', 'Créteil', '94000', 48.7911, 2.4628),
  ('94', 'Vitry-sur-Seine', '94400', 48.7872, 2.3928),
  ('94', 'Saint-Maur-des-Fossés', '94100', 48.7939, 2.5000),
  ('94', 'Champigny-sur-Marne', '94500', 48.8178, 2.5156),
  ('94', 'Ivry-sur-Seine', '94200', 48.8156, 2.3878),
  ('94', 'Maisons-Alfort', '94700', 48.8067, 2.4364),
  ('94', 'Fontenay-sous-Bois', '94120', 48.8517, 2.4783),
  ('94', 'Villejuif', '94800', 48.7922, 2.3628),
  ('94', 'Vincennes', '94300', 48.8478, 2.4389),
  ('94', 'Alfortville', '94140', 48.8056, 2.4219),
  ('94', 'Choisy-le-Roi', '94600', 48.7628, 2.4097),
  ('94', 'Le Kremlin-Bicêtre', '94270', 48.8106, 2.3597),
  ('94', 'Thiais', '94320', 48.7639, 2.3931),
  ('94', 'Nogent-sur-Marne', '94130', 48.8375, 2.4833),
  ('94', 'Cachan', '94230', 48.7947, 2.3317)
ON CONFLICT (departement_code, nom, code_postal) DO NOTHING;

-- 95 Val-d'Oise
INSERT INTO zones_villes (departement_code, nom, code_postal, lat, lng) VALUES
  ('95', 'Argenteuil', '95100', 48.9472, 2.2467),
  ('95', 'Sarcelles', '95200', 48.9933, 2.3808),
  ('95', 'Cergy', '95000', 49.0369, 2.0783),
  ('95', 'Garges-lès-Gonesse', '95140', 48.9683, 2.4017),
  ('95', 'Franconville', '95130', 48.9867, 2.2331),
  ('95', 'Goussainville', '95190', 49.0333, 2.4667),
  ('95', 'Bezons', '95870', 48.9264, 2.2119),
  ('95', 'Ermont', '95120', 48.9903, 2.2594),
  ('95', 'Villiers-le-Bel', '95400', 49.0042, 2.3942),
  ('95', 'Pontoise', '95000', 49.0508, 2.1006),
  ('95', 'Taverny', '95150', 49.0253, 2.2253),
  ('95', 'Saint-Gratien', '95210', 48.9678, 2.2847),
  ('95', 'Herblay-sur-Seine', '95220', 48.9908, 2.1644),
  ('95', 'Eaubonne', '95600', 48.9922, 2.2797),
  ('95', 'Montmorency', '95160', 48.9900, 2.3236)
ON CONFLICT (departement_code, nom, code_postal) DO NOTHING;

-- 60 Oise
INSERT INTO zones_villes (departement_code, nom, code_postal, lat, lng) VALUES
  ('60', 'Beauvais', '60000', 49.4304, 2.0795),
  ('60', 'Compiègne', '60200', 49.4178, 2.8264),
  ('60', 'Creil', '60100', 49.2583, 2.4836),
  ('60', 'Nogent-sur-Oise', '60180', 49.2739, 2.4697),
  ('60', 'Senlis', '60300', 49.2069, 2.5853),
  ('60', 'Méru', '60110', 49.2336, 2.1339),
  ('60', 'Chantilly', '60500', 49.1944, 2.4683),
  ('60', 'Clermont', '60600', 49.3797, 2.4136),
  ('60', 'Noyon', '60400', 49.5808, 2.9997),
  ('60', 'Pont-Sainte-Maxence', '60700', 49.3031, 2.6036),
  ('60', 'Chambly', '60230', 49.1672, 2.2461),
  ('60', 'Montataire', '60160', 49.2567, 2.4383),
  ('60', 'Lamorlaye', '60260', 49.1578, 2.4406),
  ('60', 'Liancourt', '60140', 49.3292, 2.4669),
  ('60', 'Neuilly-en-Thelle', '60530', 49.2269, 2.2833)
ON CONFLICT (departement_code, nom, code_postal) DO NOTHING;
