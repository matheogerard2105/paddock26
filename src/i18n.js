/* =====================================================================
   LANGUE : français (langue du jeu) ou anglais
   Le texte est écrit en français partout ; en anglais, I18N traduit :
   - les textes de l'interface (dictionnaire exact + motifs pour les textes composés), automatiquement dès qu'ils
     apparaissent dans la page (MutationObserver) ;
   - les textes dessinés dans les vidéos, via tr() / L(fr, en) appelés par le code de dessin.
   ===================================================================== */
const I18N = (() => {
  let lang = 'fr';
  const EN = new Map(Object.entries({
    // ---- accueil, menus
    'Simulateur de course automobile. Tracés GPS réels, physique d\'adhérence, aspiration, mode Overtake et aéro active.': 'Motor racing simulator. Real GPS track layouts, grip physics, slipstream, Overtake mode and active aero.',
    'Simulateur de course · tracés GPS réels · physique d’adhérence': 'Racing simulator · real GPS layouts · grip physics',
    'Course rapide': 'Quick race', 'Rouler': 'Drive', 'Carrière': 'Career', 'Grand Prix': 'Grand Prix', 'Contre-la-montre': 'Time trial',
    'Multijoueur': 'Multiplayer', 'Écuries': 'Teams', 'Replays': 'Replays',
    'Championnat : 24 manches, évolutions des voitures, crée ton pilote ou ton écurie.': 'Championship: 24 rounds, car upgrades, create your own driver or team.',
    'Crée ton pilote ou ton écurie et vise le titre : 24 manches, évolutions des voitures, saisons enchaînées.': 'Create your driver or team and go for the title: 24 rounds, car upgrades, back-to-back seasons.',
    'Continuer la carrière': 'Continue career', 'Carrière · saison terminée': 'Career · season over',
    'Une course, en pilote ou en spectateur.': 'One race, as a driver or a spectator.', 'Records et fantôme.': 'Records and ghost.',
    'À plusieurs sur le même Wi-Fi.': 'Several players on the same Wi-Fi.', 'Performances des voitures et des pilotes.': 'Car and driver performance.',
    'Replays sauvegardés, à revoir et à filmer.': 'Saved replays, to watch and film again.',
    'Crédits & mentions légales · jeu non officiel': 'Credits & legal · unofficial game', 'Crédits & mentions légales': 'Credits & legal',
    'Version d’essai': 'Trial version', '· Grand Prix et contre-la-montre sur Monaco, la Grande-Bretagne et l’Italie.': '· Grand Prix and time trial in Monaco, Great Britain and Italy.',
    'Tout débloquer': 'Unlock everything', 'La version complète arrivera bientôt sur le Play Store.': 'The full version is coming soon to the Play Store.', 'Circuit': 'Circuit', '24 circuits': '24 circuits', 'Circuits bonus': 'Bonus circuits',
    'Anciens Grands Prix · 16 circuits': 'Historic Grands Prix · 16 circuits', 'Marathon · 24 circuits enchaînés': 'Marathon · 24 circuits in a row',
    'Un tour sur chaque circuit, dans l’ordre du calendrier, sans t’arrêter : quand tu passes la ligne, tu passes aussitôt celle du circuit suivant, à la même vitesse. Limites de piste : +1 s par sortie ; accident : +10 s et tu repars.': 'One lap of each circuit, in calendar order, without stopping: when you cross the line you are instantly on the next circuit at the same speed. Track limits: +1 s per excursion; crash: +10 s and you go again.',
    'Lancer le marathon': 'Start the marathon', 'Réinitialiser mes records': 'Reset my records', 'Réglages': 'Settings', 'OK': 'OK',
    'Course': 'Race', 'Nombre de tours': 'Number of laps', 'Usure des pneus': 'Tyre wear', 'Incidents': 'Incidents', 'Météo': 'Weather',
    '« Stratégie complète » adapte l\'usure à la distance choisie pour qu\'une course courte ait quand même ses arrêts aux stands. « Usure réelle » garde la dégradation d\'un Grand Prix complet. À partir de 5 tours, un arrêt aux stands est obligatoire (deux types de pneus slicks à utiliser) ; en dessous, pas d\'arrêt.': '“Full strategy” scales wear to the chosen distance so that a short race still has pit stops. “Real wear” keeps the degradation of a full Grand Prix. From 5 laps, one pit stop is mandatory (two slick compounds must be used); below that, no stop.',
    'Pilotage': 'Driving', 'Ta voiture': 'Your car', 'Rythme des IA': 'AI pace', 'Aide au freinage': 'Braking aid', 'Limites de piste': 'Track limits',
    'Collisions': 'Collisions', 'Options': 'Options', 'Direction': 'Steering', 'Moteur': 'Engine', 'Dégâts': 'Damage', 'Commandes': 'Controls',
    'Langue': 'Language', 'Langue · Language': 'Language · Langue', 'Vidéos TikTok': 'TikTok videos',
    'Ton nom': 'Your name', 'Créer une partie': 'Host a game', 'Parties trouvées sur le Wi-Fi': 'Games found on Wi-Fi',
    'Rejoindre avec l’adresse de l’hôte': 'Join with the host address', 'Rejoindre': 'Join', 'Écuries & pilotes': 'Teams & drivers',
    '11 équipes · 22 pilotes': '11 teams · 22 drivers', 'Tout équilibrer à 50': 'Set everything to 50', 'Réglages réalistes': 'Realistic settings',
    'Noms des écuries et des pilotes': 'Team and driver names',
    'Les noms du jeu sont fictifs : chaque écurie porte le nom de la ville de son usine, chaque pilote garde son numéro et sa nationalité. Tu peux les renommer comme tu veux (dans chaque écurie ci-dessous), ou coller un « pack de noms » partagé par un autre joueur.': 'In-game names are fictional: each team is named after its factory town, each driver keeps their number and nationality. You can rename them as you like (in each team below), or paste a “name pack” shared by another player.',
    'Les noms du jeu sont fictifs : chaque écurie porte le nom de la ville de son usine. Dans chaque écurie ci-dessous, tu peux changer les noms, les couleurs, les numéros et les drapeaux des pilotes, ou coller un « pack de noms » partagé par un autre joueur (couleurs et numéros compris, après « | »).': 'In-game names are fictional: each team is named after its factory town. In each team below you can change names, colours, driver numbers and flags, or paste a “name pack” shared by another player (colours and numbers included, after “|”).',
    'Pack de noms': 'Name pack', 'Noms d’origine': 'Original names', 'Appliquer le pack': 'Apply pack', 'Départ direct': 'Skip to race', 'Qualifications': 'Qualifying',
    'Lancer le contre-la-montre': 'Start time trial', 'Spectateur (toutes les voitures en IA)': 'Spectator (all cars AI)', 'Tu pilotes': 'You drive', 'Spectateur': 'Spectator',
    'Renommer': 'Rename', 'Enregistrer': 'Save', 'Numéro de 0 à 99': 'Number from 0 to 99', 'Numéro déjà pris': 'Number already taken', 'N°': 'No.', 'Drapeau': 'Flag', 'Pilote': 'Driver', 'Nom déjà utilisé': 'Name already used', 'Copie ce texte pour le partager, ou modifie la partie après « = » puis applique.': 'Copy this text to share it, or edit the part after “=” then apply.',
    // ---- choix (puces)
    'Réalistes': 'Realistic', 'Abandons seuls': 'Retirements only', 'Sans abandon': 'No retirements', 'Assistée': 'Assisted', 'Semi': 'Semi', 'Libre': 'Free',
    'Hybride 2026': 'Hybrid 2026', '100 % thermique': '100 % combustion', 'Un doigt': 'One finger', 'Boutons': 'Buttons', 'Stratégie complète': 'Full strategy',
    'Usure réelle': 'Real wear', 'Réaliste': 'Realistic', 'Agité': 'Lively', 'Chaos': 'Chaos', 'Sec': 'Dry', 'Pluie légère': 'Light rain', 'Pluie forte': 'Heavy rain',
    'Averses possibles': 'Possible showers', 'Variable': 'Changeable', 'Complet': 'Full', 'Strictes': 'Strict', 'Indulgentes': 'Lenient', 'Aucune': 'None',
    'Automatique': 'Automatic', 'Aide': 'Assist', 'Débutant': 'Beginner', 'Légende': 'Legend', 'Sur mesure': 'Custom', 'Écurie existante': 'Existing team',
    'Créer mon pilote': 'Create my driver', 'Créer mon écurie': 'Create my team', 'Fond de grille': 'Back of the grid', 'Milieu de grille': 'Midfield',
    'Top team': 'Top team', 'Star': 'Star', 'Fusée': 'Rocket', 'Coéquipier': 'Teammate', 'Pilote': 'Driver', 'Officielle': 'Official', 'Régions de France': 'Regions of France',
    'Français': 'Français', 'English': 'English', 'Zones TikTok': 'TikTok safe zones', 'Plein écran': 'Full frame', 'Activé': 'On', 'Désactivé': 'Off',
    'Aucune voiture ne peut abandonner, IA comprises. Un choc contre une voiture ou un mur ralentit, sans casse ni crevaison.': 'No car can retire, AI included. Hitting a car or a wall slows you down, without damage or punctures.',
    'Les gros accidents peuvent provoquer des abandons (et donc la Safety Car), mais les petits chocs n’abîment rien : jamais d’arrêt forcé pour réparer.': 'Big crashes can cause retirements (and so the Safety Car), but small hits break nothing: never a forced stop for repairs.',
    'Chocs et sorties peuvent abîmer l’aileron, crever un pneu ou mettre fin à ta course.': 'Hits and offs can damage the wing, puncture a tyre or end your race.',
    'Moteur 2026 : moitié thermique, moitié électrique. Gère la batterie (ERS) et le mode Overtake.': '2026 engine: half combustion, half electric. Manage the battery (ERS) and Overtake mode.',
    'Moteur thermique seul (≈ 815 ch), puissance constante : pas de batterie, pas d’ERS ni d’Overtake. Seul le pilotage compte. Records du contre-la-montre séparés.': 'Combustion engine only (≈ 815 hp), constant power: no battery, no ERS or Overtake. Only driving matters. Separate time trial records.',
    'Hybride 2026 : batterie, récupération d’énergie et mode Overtake.': 'Hybrid 2026: battery, energy recovery and Overtake mode.',
    'Moteurs thermiques seuls (≈ 815 ch) : pas de batterie, pas de mode Overtake. Fixé pour toute la carrière.': 'Combustion engines only (≈ 815 hp): no battery, no Overtake mode. Fixed for the whole career.',
    'Les vidéos (highlights, clips, présentation, grille) gardent leurs textes hors des zones couvertes par l’interface de TikTok (haut, bas, droite).': 'Videos (highlights, clips, preview, grid) keep their text out of the areas covered by the TikTok interface (top, bottom, right).',
    'Les textes des vidéos occupent toute l’image.': 'Video overlays use the whole frame.',
    // ---- carrière
    'Nouvelle carrière': 'New career', 'Ces réglages sont fixés pour toute la carrière : ils ne changent pas quand tu modifies ceux du Grand Prix.': 'These settings are fixed for the whole career: they do not change when you edit the Grand Prix ones.',
    'Ton rôle': 'Your role', 'Nom de l’écurie': 'Team name', 'Couleur principale': 'Main colour', 'Couleur secondaire': 'Secondary colour', 'Motoriste': 'Engine supplier',
    'Performance de la voiture': 'Car performance', 'Ton pilote (prénom nom)': 'Your driver (first last name)', 'Numéro': 'Number', 'Ton niveau de pilote': 'Your driver level',
    'Ton écurie': 'Your team', 'Tu remplaces': 'You replace', 'Ton coéquipier': 'Your teammate', 'Niveau du coéquipier': 'Teammate level', 'Annuler': 'Cancel',
    'Créer la carrière': 'Create career', 'Grille': 'Grid', 'Les écuries deviennent des régions françaises et les pilotes de grandes villes (noms, couleurs et drapeaux), le temps de la carrière.': 'Teams become French regions and drivers big cities (names, colours and flags), for this career only.',
    'Les noms et couleurs du jeu (ou ton pack de noms).': 'In-game names and colours (or your name pack).',
    '+ Nouvelle': '+ New', 'Championnat 2026': 'Championship 2026', 'Courir ce GP': 'Race this GP', 'Simuler ce GP': 'Simulate this GP', 'Pilotes': 'Drivers', 'Notes': 'Ratings',
    'Évolutions': 'Upgrades', 'Course au titre': 'Title fight', 'points cumulés après chaque manche · touche un nom pour le suivre (5 max)': 'cumulative points after each round · tap a name to follow it (5 max)', 'Le graphique apparaîtra après la première manche.': 'The chart will appear after the first round.', '🎬 Résumé de la saison': '🎬 Season recap', '🎬 Course au titre pilotes': '🎬 Drivers’ title fight', '🎬 Course au titre écuries': '🎬 Teams’ title fight', '🎬 Évolutions de la saison': '🎬 Season upgrades', '🎬 Les exploits de la saison': '🎬 Giant-killing drives', '🎬 Saison du pilote': '🎬 Driver’s season', 'Préparation des extraits…': 'Preparing clips…', 'Calendrier': 'Calendar', 'Menu': 'Menu', 'Supprimer la carrière': 'Delete career', 'Abandonner et recommencer': 'Abandon and restart',
    'Saison terminée': 'Season over', 'Confirmer la suppression ?': 'Confirm deletion?', 'Suite du championnat': 'Back to the championship',
    'Sauvegarde de course introuvable : la manche reprend depuis le début.': 'Race save not found: the round restarts from the beginning.',
    '🎬 Vidéo présentation': '🎬 Preview video', '🎬 Vidéo de la saison': '🎬 Season video', '🎬 Vidéo de la grille': '🎬 Grid video',
    'Pts': 'Pts', 'V': 'W', 'Pole': 'Pole', 'Poles': 'Poles', 'Titres': 'Titles', 'Victoires': 'Wins', 'Podiums': 'Podiums', 'Points': 'Points', 'Courses': 'Races', 'Abandons': 'Retirements', 'Meilleur class.': 'Best finish', '% podiums': '% podiums', 'en cours': 'ongoing', 'Toi': 'You', 'Pod.': 'Pod.', 'Note': 'Rating', 'Saison': 'Season', 'Performance': 'Performance', 'Évol.': 'Change', 'Vainqueur': 'Winner',
    'prochaine manche': 'next round', 'aucune évolution': 'no upgrade', 'réf.': 'ref.',
    // ---- qualifs
    'Chaque temps est un vrai tour simulé avec la même physique que la course (pneus tendres, peu d\'essence). Éliminés Q1 : P17–22, Q2 : P11–16.': 'Every time is a real simulated lap with the same physics as the race (soft tyres, low fuel). Out in Q1: P17–22, Q2: P11–16.',
    'Faire mon tour de qualif': 'Do my qualifying lap', 'Écart': 'Gap', 'Simulateur de stratégie': 'Strategy simulator', 'Nombre d’arrêts': 'Number of stops',
    'Retour': 'Back', 'Départ de la course': 'Start the race', 'POLE': 'POLE', 'pas de tour': 'no lap', 'sans temps': 'no time',
    // ---- course
    'INTERVALLE': 'INTERVAL', 'ÉCART LEADER': 'GAP TO LEADER', 'VERT': 'GREEN', 'JAUNE': 'YELLOW', 'SEC': 'DRY', 'TOUR DE LANCEMENT': 'FORMATION LAP',
    'GRILLE': 'GRID', 'ARRIVÉE': 'FINISH', 'DAMIER': 'CHEQUERED', 'RELANCE': 'RESTART', 'SC RENTRE': 'SC IN', 'FIN VSC': 'VSC ENDING', 'NE PAS DÉPASSER': 'NO OVERTAKING',
    'GO ! GO ! GO !': 'GO! GO! GO!', 'FAUX DÉPART ! +5 s': 'JUMP START! +5 s', 'En tête': 'Leading', 'TÊTE': 'LEADER', 'STAND': 'PIT', 'Batterie': 'Battery',
    'Tours': 'Laps', 'Devant': 'Ahead', 'FREINE': 'BRAKE', 'PNEUS': 'TYRES', 'FREIN': 'BRAKE', 'GAZ': 'GAS', 'RECHARGE': 'HARVEST', 'ROUE LIBRE': 'COASTING',
    'ROUE LIBRE · tourner sans accélérer': 'COASTING · turn without throttle', 'Pause': 'Pause', 'Reprendre': 'Resume', 'TV': 'TV', 'Réalisateur': 'Director',
    'Bord de piste': 'Trackside', 'Hélico': 'Helicopter', 'Embarquée': 'Onboard', 'Circuit ': 'Track', 'Classement': 'Standings', '▶ Replay du record': '▶ Record replay',
    '▶ Replay du tour': '▶ Lap replay', 'Quitter ?': 'Quit?', 'Quitter': 'Quit', 'REPLAY': 'REPLAY', '−10 s': '−10 s', 'Annuler ': 'Cancel', '▶ Reprendre': '▶ Resume',
    'Début ici': 'Start here', 'Fin ici': 'End here', 'Place le début et la fin': 'Set start and end', 'Place le début': 'Set the start', 'Place la fin': 'Set the end',
    '⬇ Vidéo': '⬇ Video', 'Revoir': 'Watch again', 'Reprendre la piste': 'Back on track', 'Abandon': 'Retired', 'Arrivée': 'Finish',
    'Regarder la course': 'Watch the race', 'Regarder la fin': 'Watch the finish', 'Simuler jusqu\'à l\'arrivée': 'Simulate to the finish',
    'Simuler jusqu’à l’arrivée': 'Simulate to the finish', 'Passer au classement': 'Go to results', '⟲ Rembobiner': '⟲ Rewind',
    'Ton tour de qualification': 'Your qualifying lap', 'Réessayer': 'Try again', 'Voir la grille': 'See the grid', 'Recommencer': 'Restart',
    'Marathon · 24 circuits': 'Marathon · 24 circuits', '✕ Fermer': '✕ Close', '⬇ Exporter la vidéo': '⬇ Export video', 'Partager': 'Share', '🎥 TV': '🎥 TV',
    'Vidéo highlights': 'Highlights video', 'Épisode commenté (en parties)': 'Commentated episode (in parts)', 'Un épisode = ce Grand Prix. Parties 1 et 2 : présentation et grille (vidéos de la carrière). Partie 3 : le départ, puis la course en parties d’environ 2 min avec tous les dépassements, les arrêts et les stratégies. Une safety car ou la pluie ouvre une nouvelle partie.': 'One episode = this Grand Prix. Parts 1 and 2: preview and grid (career videos). Part 3: the start, then the race in parts of about 2 min with every overtake, pit stop and strategy. A safety car or rain starts a new part.', 'Format vertical 9:16, prêt pour TikTok, Reels et Shorts.': 'Vertical 9:16, ready for TikTok, Reels and Shorts.',
    'Résumé de la course': 'Race summary', 'Intro (grille, hiérarchie, championnat), départ, dépassements, stratégies, arrivée et résultats.': 'Intro (grid, pecking order, championship), start, overtakes, strategies, finish and results.',
    'La course d’un pilote (jusqu’à 3 min)': 'One driver’s race (up to 3 min)', 'Edit TikTok en musique (≈ 40 s, le pilote choisi au-dessus)': 'TikTok music edit (≈ 40 s, driver chosen above)', '🎵 Créer': '🎵 Create',
    'Phonk · 140 BPM': 'Phonk · 140 BPM', 'Électro · 128 BPM': 'Electro · 128 BPM', 'Sans musique · coupes à 128 BPM': 'No music · cuts at 128 BPM', 'Ta musique (fichier audio)…': 'Your music (audio file)…', 'Caméra bord de piste': 'Trackside camera', 'Réglages ▾': 'Settings ▾', '📍 Ici (devant la voiture)': '📍 Here (ahead of the car)', '⇄ Côté': '⇄ Side', 'Suit la voiture': 'Follows the car', 'Auto': 'Auto', 'Endroit': 'Spot', 'Distance': 'Distance', 'Hauteur': 'Height', 'Angle': 'Angle', 'Zoom': 'Zoom', 'Musique composée par l’appli, sans droits d’auteur : chaque coupe tombe sur le rythme, l’extinction des feux sur le drop.': 'Music composed by the app, copyright-free: every cut lands on the beat, lights out on the drop.', 'Voir': 'Watch', 'Résultats': 'Results', 'Temps': 'Time', 'Arrêts': 'Stops',
    'Meilleur tour': 'Fastest lap', 'Évolution des positions': 'Position changes', 'Trait plein : 1er pilote de l\'écurie · pointillés : 2e · ✕ abandon': 'Solid: team’s 1st driver · dashed: 2nd · ✕ retired',
    'Voir la piste': 'See the track', 'Revoir la course': 'Watch the replay', '▶ Highlights': '▶ Highlights', 'Nouveau Grand Prix': 'New Grand Prix',
    '💾 Sauvegarder le replay': '💾 Save replay', 'Replay sauvegardé ✓': 'Replay saved ✓', 'Retour aux replays': 'Back to replays',
    'Disqualifié': 'Disqualified', 'Retour au menu': 'Back to menu', 'Retour au multijoueur': 'Back to multiplayer',
    'Départ (1 min)': 'Start (1 min)', '1 min d’ici': '1 min from here', 'Activer le son': 'Turn sound on', 'Couper le son': 'Mute',
    'Enregistrement de la vidéo… laisse défiler jusqu’au bout': 'Recording the video… let it play to the end', 'Préparation de la vidéo…': 'Preparing the video…',
    'Export vidéo non disponible sur cet appareil': 'Video export not available on this device', 'Enregistrement annulé': 'Recording cancelled',
    'Enregistrement impossible ici': 'Recording not possible here', 'Échec de l’enregistrement de la vidéo': 'Failed to save the video',
    // ---- replays sauvegardés
    'Replays sauvegardés': 'Saved replays', 'Importer un fichier': 'Import a file', 'Regarder': 'Watch', 'Exporter': 'Export', 'Supprimer': 'Delete',
    'Aucun replay sauvegardé. À la fin d’une course, touche « 💾 Sauvegarder le replay ».': 'No saved replay. At the end of a race, tap “💾 Save replay”.',
    'Les replays restent sur ce téléphone. « Exporter » en fait un fichier (dossier Téléchargements/Paddock26) pour ne rien perdre, que tu peux réimporter ici.': 'Replays stay on this phone. “Export” makes a file (Downloads/Paddock26 folder) so nothing is lost, which you can import back here.',
    'Sûr ?': 'Sure?', 'Fichier de replay illisible.': 'Unreadable replay file.', 'Replay importé ✓': 'Replay imported ✓', 'Chargement…': 'Loading…',
    // ---- divers
    'Version complète': 'Full version', 'Plus tard': 'Later', 'Débloquer': 'Unlock', 'Jeu non officiel.': 'Unofficial game.', 'Logiciels et données tiers': 'Third-party software and data',
    'Joueurs': 'Players', 'Salon multijoueur': 'Multiplayer lobby', 'Lancer la course': 'Start the race', 'Quitter le salon': 'Leave the lobby', 'Tu héberges la partie': 'You are hosting',
    'Partie rejointe': 'Game joined', 'Recherche des parties…': 'Searching for games…', 'Adresse invalide': 'Invalid address', 'L’hôte a fermé la partie.': 'The host closed the game.',
    'Confirmer : tout effacer ?': 'Confirm: erase everything?', 'Code incorrect pour cet appareil.': 'Wrong code for this device.', 'Version complète débloquée. Merci !': 'Full version unlocked. Thank you!',
    'Sûr ? La course en cours sera perdue': 'Sure? The current race will be lost', 'Circuits': 'Circuits', 'Contre-la-montre ': 'Time trial',
    'Course sauvegardée ✓ — reprends-la quand tu veux, même dans plusieurs semaines.': 'Race saved ✓ — resume it whenever you want, even weeks later.',
    'Sons du moteur synthétisés par le jeu. Code et graphismes du jeu © Paddock 26.': 'Engine sounds synthesised by the game. Game code and graphics © Paddock 26.',
    // ---- libellés des messages
    'Pénalité': 'Penalty', 'Dépassement': 'Overtake', 'Accident': 'Crash', 'Contact': 'Contact', 'Incident': 'Incident', 'Safety car': 'Safety car', 'VSC': 'VSC',
    'Drapeau vert': 'Green flag', 'Stands': 'Pits', 'Départ': 'Start', 'Course ': 'Race',
    // ---- vidéos (textes dessinés)
    'CLASSEMENT': 'STANDINGS', 'PNEU': 'TYRE', 'ARR.': 'STOPS', 'ARRIVÉ': 'FINISHED', 'OUT': 'OUT', 'TOUR': 'LAP', 'DERNIER TOUR': 'FINAL LAP',
    'SAFETY CAR': 'SAFETY CAR', 'DUEL · DERNIERS TOURS': 'DUEL · LAST LAPS', 'STANDS': 'PIT', 'MEILLEUR TOUR': 'FASTEST LAP', 'PÉNALITÉ': 'PENALTY', 'MÉTÉO': 'WEATHER',
    'GRAND PRIX': 'GRAND PRIX', 'CHAMPIONNAT': 'CHAMPIONSHIP', 'Après la course': 'After the race', 'Évolutions de la semaine': 'This week’s upgrades',
    'Forces en présence': 'Pecking order', 'HIÉRARCHIE': 'PECKING ORDER', 'GROS PACKAGE': 'BIG PACKAGE', 'évolution': 'upgrade', '▼ raté': '▼ failed',
    'GRILLE DE DÉPART': 'STARTING GRID', 'Bilan': 'Summary', 'APRÈS LE 1ER TOUR': 'AFTER LAP 1', 'Aucun changement de position': 'No position change',
    'STRATÉGIES': 'STRATEGIES', 'Classement final': 'Final classification', 'RÉSULTATS': 'RESULTS', 'DISQ.': 'DSQ', 'ABANDON': 'DNF', 'PILOTE DU JOUR': 'DRIVER OF THE DAY',
    'BILAN': 'SUMMARY', '★ PILOTE DU JOUR': '★ DRIVER OF THE DAY', 'SA COURSE': 'THEIR RACE', 'DÉPART': 'START', 'MEILLEUR TOUR ': 'FASTEST LAP', 'QUALIF': 'QUALI',
    'DÉPASSEMENTS': 'OVERTAKES', '= position conservée': '= position kept', 'PODIUM': 'PODIUM', 'Abonne-toi pour le prochain Grand Prix': 'Follow for the next Grand Prix',
    'PERD LA TÊTE': 'LOSES THE LEAD', 'DÉPASSÉ': 'OVERTAKEN', 'TRIPLE DÉPASSEMENT !': 'TRIPLE OVERTAKE!', 'DOUBLE DÉPASSEMENT !': 'DOUBLE OVERTAKE!',
    'PRISE DE LA TÊTE !': 'TAKES THE LEAD!', 'DANS LE DERNIER TOUR !': 'ON THE FINAL LAP!', 'DUEL ENTRE COÉQUIPIERS': 'TEAMMATE DUEL', 'QUEL DÉPASSEMENT !': 'WHAT A MOVE!',
    'DÉPASSEMENT': 'OVERTAKE', 'CRASH !': 'CRASH!', 'CREVAISON !': 'PUNCTURE!', 'ACCROCHAGE': 'COLLISION', 'La course est neutralisée': 'The race is neutralised',
    'ARRÊT AUX STANDS': 'PIT STOP', 'UNDERCUT RÉUSSI !': 'UNDERCUT WORKS!', 'OVERCUT RÉUSSI !': 'OVERCUT WORKS!', 'GUERRE INTERNE !': 'TEAM WAR!',
    'BATAILLE POUR LA VICTOIRE': 'BATTLE FOR THE WIN', 'BATAILLE !': 'BATTLE!', 'NOUVEAU LEADER !': 'NEW LEADER!', 'ABANDON !': 'RETIREMENT!',
    'VIRTUAL SAFETY CAR': 'VIRTUAL SAFETY CAR', 'SAFETY CAR !': 'SAFETY CAR!', 'COUP STRATÉGIQUE': 'STRATEGY CALL', 'LA PLUIE ARRIVE !': 'HERE COMES THE RAIN!',
    'FIN DE LA PLUIE': 'RAIN STOPS', 'Qui osera passer aux pneus pluie en premier ?': 'Who will dare to switch to wets first?',
    'La piste sèche : qui repassera aux slicks ?': 'The track is drying: who goes back to slicks?', 'LE PREMIER À CHANGER': 'FIRST TO SWITCH',
    'RETOUR AUX SLICKS': 'BACK TO SLICKS', 'EXTINCTION DES FEUX !': 'LIGHTS OUT!', 'VICTOIRE !': 'VICTORY!', 'REMONTÉE !': 'COMEBACK!',
    'ÇA VA MAL FINIR…': 'THIS WON’T END WELL…', 'REGARDE ÇA…': 'WATCH THIS…', 'La suite dans la vidéo 👀': 'Watch till the end 👀',
    // ---- messages de course (simulation)
    'La pluie commence à tomber !': 'Rain is starting to fall!', 'La pluie s\'arrête, la piste va sécher': 'The rain stops, the track will dry',
    'Piste presque sèche : place aux slicks !': 'Track almost dry: time for slicks!', 'Piste mouillée : les slicks ne tiennent plus': 'Wet track: slicks no longer grip',
    'SAFETY CAR DÉPLOYÉE': 'SAFETY CAR DEPLOYED', 'FIN DU VSC — préparez-vous': 'VSC ENDING — get ready', 'DRAPEAU VERT': 'GREEN FLAG',
    'SAFETY CAR RENTRE À CE TOUR': 'SAFETY CAR IN THIS LAP', 'Le leader contrôle la relance…': 'The leader controls the restart…',
    'RELANCE ! Dépassements autorisés après la ligne': 'RESTART! Overtaking allowed after the line', 'Tour annulé : limites de piste': 'Lap deleted: track limits',
    'Limites de piste : +1 s': 'Track limits: +1 s', 'Tour annulé : limites de piste dépassées': 'Lap deleted: track limits exceeded',
  }));

  // ---- complément : phrases des réglages, accessibilité, pays, évolutions
  const MORE = {
    'Freinage automatique : la voiture freine toute seule avant les virages.': 'Automatic braking: the car brakes by itself before corners.',
    'Aide au freinage : la voiture freine pour toi si tu arrives beaucoup trop vite.': 'Braking aid: the car brakes for you if you arrive far too fast.',
    'Aucune aide : tu freines toi-même.': 'No aid: you do the braking.', 'Les zones de freinage sont affichées sur la piste.': 'Braking zones are shown on the track.',
    'Pas de tête-à-queue.': 'No spins.', 'Tête-à-queue possibles.': 'Spins are possible.', 'En contre-la-montre, un tour hors des limites de piste est annulé.': 'In time trial, a lap outside track limits is deleted.',
    'À 100 %, les IA exploitent toute l’adhérence de leur voiture ; au-delà, elles vont plus loin, comme un pilote qui « attaque » les épingles et les vibreurs.': 'At 100 %, the AI uses all the grip of its car; above that it goes further, like a driver attacking hairpins and kerbs.',
    'Un doigt : appuie à gauche ou à droite de l’écran pour tourner (plus tu t’éloignes du centre, plus tu braques).': 'One finger: press on the left or right of the screen to steer (the further from the centre, the more you steer).',
    'Tant que tu appuies, tu accélères ; relâche pour freiner, de plus en plus fort.': 'While you press, you accelerate; release to brake, harder and harder.',
    'Sans aide au freinage, une bande « roue libre » en bas de l’écran permet de tourner sans accélérer.': 'Without braking aid, a coasting strip at the bottom of the screen lets you turn without accelerating.',
    'Boutons : ◀ ▶ pour tourner, FREIN et GAZ à maintenir.': 'Buttons: ◀ ▶ to steer, hold BRAKE and GAS.', 'Sans pédale, la voiture roule en roue libre.': 'With no pedal pressed, the car coasts.',
    'Direction assistée : la voiture suit la courbe de la piste, tu choisis ta trajectoire et tes points de freinage.': 'Assisted steering: the car follows the curve of the track, you choose your line and braking points.',
    'Direction semi-assistée : la voiture prend une partie du virage toute seule, à toi de compléter le braquage (ou d’en retirer) pour rester sur la piste.': 'Semi-assisted steering: the car takes part of the corner by itself, you add (or remove) steering to stay on track.',
    'Direction libre : tu tiens le volant, la voiture va tout droit si tu ne tournes pas.': 'Free steering: you hold the wheel, the car goes straight if you don’t turn.',
    'La qualification de ta voiture est faite par l’IA.': 'Your car’s qualifying is done by the AI.', 'Clavier : flèches, O pour Overtake, B pour les stands.': 'Keyboard: arrows, O for Overtake, B for the pits.',
    'Tours lancés seul en piste, records et fantôme.': 'Solo flying laps, records and ghost.', 'Pas encore de marathon bouclé.': 'No marathon completed yet.',
    'Tous les circuits sont bouclés : améliore tes records pour faire baisser le total.': 'All circuits done: improve your records to lower the total.',
    'Le multijoueur Wi-Fi fonctionne dans l’appli Android : dans un navigateur, tu peux seulement rejoindre une partie avec l’adresse de l’hôte.': 'Wi-Fi multiplayer works in the Android app: in a browser you can only join a game with the host address.',
    'Touche une ligne ou un code pour suivre un pilote': 'Tap a line or a code to follow a driver', 'Écart au plus rapide': 'Gap to the fastest',
    'secondes au tour, avant chaque GP': 'seconds per lap, before each GP', 'touche une écurie pour la suivre (3 max)': 'tap a team to follow it (3 max)',
    'Meilleurs pilotes de la carrière': 'Best drivers of the career', 'Palmarès': 'Honours', 'Année': 'Year', 'Titres': 'Titles', 'Écurie': 'Team', 'Confirmé': 'Experienced',
    'Départs': 'Starts', 'Aéro / virages': 'Aero / corners', 'Moteur / vitesse de pointe': 'Engine / top speed', 'Gestion des pneus': 'Tyre management',
    'Régularité (peu d’erreurs)': 'Consistency (few mistakes)', 'talent': 'talent', 'Donne un prénom et un nom à ton pilote.': 'Give your driver a first and last name.',
    'Donne un prénom et un nom à ton coéquipier.': 'Give your teammate a first and last name.', 'Zones de freinage': 'Braking zones', 'Anti tête-à-queue': 'Anti-spin',
    'AÉRO Z': 'AERO Z', 'TENDRE': 'SOFT', 'DUR': 'HARD', 'INTERMÉDIAIRE': 'INTER', 'PLUIE': 'WET', 'RAP.': 'GEAR', 'Rembobinage': 'Rewind', 'AÉRO X': 'AERO X', 'spectateur': 'spectator', 'Pilote auto': 'Auto driver', 'Multijoueur Wi-Fi': 'Wi-Fi multiplayer', 'en tête': 'leading',
    'Thermique': 'Combustion', 'hybride': 'hybrid', 'stratégie complète': 'full strategy', 'usure réelle': 'real wear', 'incidents réalistes': 'realistic incidents',
    'incidents agités': 'lively incidents', 'incidents chaos': 'chaos incidents', 'sans abandon': 'no retirements', 'dégâts réalistes': 'realistic damage', 'abandons seuls': 'retirements only',
    'freinage aidé': 'braking assist', 'freinage automatique': 'automatic braking', 'freinage libre': 'no braking aid', 'direction assistée': 'assisted steering', 'direction semi': 'semi steering', 'direction libre': 'free steering',
    'Pneus :': 'Tyres:', 'tendre': 'soft', 'dur': 'hard', 'saison terminée': 'season over', 'Titre pilotes': 'Drivers’ title',
    // accessibilité
    'Modes de jeu': 'Game modes', 'Réglages de course': 'Race settings', 'Crédits et mentions légales': 'Credits and legal', 'Réglages de la course': 'Race settings',
    'Ton rôle dans la carrière': 'Your role in the career', 'Réglages de la carrière': 'Career settings', 'Temps au tour prévus pour ta stratégie': 'Expected lap times for your strategy',
    'Carte du circuit': 'Track map', 'Données de conduite': 'Driving data', 'Pneus au prochain arrêt': 'Tyres at the next stop', 'Pilote précédent': 'Previous driver', 'Pilote suivant': 'Next driver',
    'Position dans le replay': 'Position in the replay', 'Fin du replay': 'End of the replay', 'Enregistrer un clip': 'Record a clip', 'Moment où reprendre': 'Moment to resume from',
    'Encore 1 seconde en arrière': '1 more second back', 'Tourner à gauche': 'Steer left', 'Tourner à droite': 'Steer right', 'Highlights de la course': 'Race highlights',
    'Choisir la vidéo': 'Choose the video', 'Écart au plus rapide par écurie et par manche': 'Gap to the fastest per team and per round', 'Positions de chaque pilote, tour par tour': 'Each driver’s position, lap by lap', 'Temps par secteur': 'Sector times', 'Son': 'Sound',
    'Rembobiner': 'Rewind', 'Code (XXXXX-XXXXX)': 'Code (XXXXX-XXXXX)', 'ex. Alex Martin': 'e.g. Alex Martin', 'ex. Phoenix Racing': 'e.g. Phoenix Racing',
    'ex. 192.168.1.20 ou 192.168.1.20:47626': 'e.g. 192.168.1.20 or 192.168.1.20:47626', 'Carrière ': 'Career',
    // pays et lieux des circuits
    'Australie': 'Australia', 'Chine': 'China', 'Japon': 'Japan', 'Bahreïn': 'Bahrain', 'Arabie Saoudite': 'Saudi Arabia', 'Barcelone': 'Barcelona', 'Autriche': 'Austria',
    'Grande-Bretagne': 'Great Britain', 'Belgique': 'Belgium', 'Hongrie': 'Hungary', 'Pays-Bas': 'Netherlands', 'Italie': 'Italy', 'Espagne': 'Spain', 'Azerbaïdjan': 'Azerbaijan',
    'Singapour': 'Singapore', 'États-Unis': 'United States', 'Mexique': 'Mexico', 'Brésil': 'Brazil', 'Abou Dhabi': 'Abu Dhabi', 'Malaisie': 'Malaysia', 'Turquie': 'Turkey',
    'Allemagne': 'Germany', 'Toscane': 'Tuscany', 'Russie': 'Russia', 'Argentine': 'Argentina', 'Afrique du Sud': 'South Africa', 'Catalogne': 'Catalonia', 'Styrie': 'Styria',
    'Hollande-Septentrionale': 'North Holland', 'Lombardie': 'Lombardy', 'île Notre-Dame': 'Notre-Dame Island', 'Île de Yas': 'Yas Island', 'Émilie-Romagne': 'Emilia-Romagna',
    'Bade-Wurtemberg': 'Baden-Württemberg', 'Rhénanie': 'Rhineland', 'Sotchi': 'Sochi', 'Djeddah': 'Jeddah', 'Bakou': 'Baku', 'Mexico': 'Mexico City',
    // évolutions techniques
    'aéro': 'aero', 'moteur / traînée': 'engine / drag', 'gestion pneus': 'tyre management', 'nouveau fond plat': 'new floor', 'aileron avant revu': 'revised front wing',
    'évolution des pontons': 'sidepod upgrade', 'nouvelle suspension avant': 'new front suspension', 'diffuseur modifié': 'modified diffuser', 'aileron arrière basse traînée': 'low-drag rear wing',
    'mise à jour du moteur': 'engine update', 'capot moteur affiné': 'slimmer engine cover', 'cartographie ERS optimisée': 'optimised ERS mapping',
    'suspension arrière retravaillée': 'reworked rear suspension', 'refroidissement des freins revu': 'revised brake cooling', 'meilleure gestion thermique des pneus': 'better tyre thermal management',
    '— usure des pneus réduite': '— tyre wear reduced', '— ratée : usure des pneus en hausse': '— failed: tyre wear increased',
  };
  for (const k in MORE) EN.set(k, MORE[k]);
  // pneus, raisons d'arrêt et d'abandon (utilisés dans les messages composés)
  const WORDS = { 'tendres': 'softs', 'mediums': 'mediums', 'durs': 'hards', 'intermédiaires': 'intermediates', 'pluie': 'wets', 'Tendre': 'Soft', 'Medium': 'Medium', 'Dur': 'Hard', 'Intermédiaire': 'Intermediate', 'Pluie': 'Wet',
    'tendre': 'soft', 'medium': 'medium', 'dur': 'hard', 'intermédiaire': 'intermediate',
    'stratégie': 'strategy', 'pneus usés': 'worn tyres', 'crevaison': 'puncture', 'dégâts': 'damage', 'nouveau museau': 'new nose', 'réparations': 'repairs',
    'arrêt sous neutralisation': 'stop under neutralisation', 'obligatoire': 'mandatory', 'pneus pluie': 'wet tyres', 'retour aux slicks': 'back to slicks',
    'accident dans le mur': 'crashed into the wall', 'bloqué dans le gravier': 'stuck in the gravel', 'percute une voiture arrêtée': 'hits a stopped car',
    'suspension cassée': 'broken suspension', 'part dans le gravier': 'goes into the gravel', 'part en tête-à-queue': 'spins', 'perd le contrôle': 'loses control',
    'Sec': 'Dry', 'Pluie légère': 'Light rain', 'Pluie forte': 'Heavy rain', 'Averses possibles': 'Possible showers' };
  const w = s => WORDS[s] || WORDS[s && s.toLowerCase()] || s;
  // motifs : textes composés (messages de la course, compteurs, résumés)
  const PAT = [
    [/^TOUR (\d+)\/(\d+)$/, 'LAP $1/$2'], [/^Tour (\d+)\/(\d+)$/, 'Lap $1/$2'], [/^TOUR (\d+)$/, 'LAP $1'], [/^Manche (\d+) \/ (\d+)$/, 'Round $1 / $2'],
    [/^MANCHE (\d+)\/(\d+) · (\d+)$/, 'ROUND $1/$2 · $3'], [/^Avant la manche (\d+)$/, 'Before round $1'], [/^Championnat (\d+)$/, 'Championship $1'],
    [/^(\d+) tours?$/, (m, n) => `${n} lap${n > 1 ? 's' : ''}`], [/^(\d+) arrêts?$/, (m, n) => `${n} stop${n > 1 ? 's' : ''}`],
    [/^PLUIE · PISTE (\d+) %$/, 'RAIN · TRACK $1 %'], [/^SÈCHE · (\d+) %$/, 'DRYING · $1 %'], [/^Réaction : (.+)$/, 'Reaction: $1'],
    [/^(\S+) dépasse (\S+) pour la P(\d+)( \(OVERTAKE\))?$/, (m, a, b, p, o) => `${a} passes ${b} for P${p}${o || ''}`],
    [/^Meilleur tour : (.+)$/, 'Fastest lap: $1'], [/^Crevaison pour (\S+) !$/, 'Puncture for $1!'], [/^(\S+) touche le mur !$/, '$1 hits the wall!'],
    [/^ABANDON : (.+) — (.+)$/, (m, a, b) => `RETIRED: ${a} — ${w(b)}`], [/^(\S+) : (.+) !$/, (m, a, b) => `${a}: ${w(b)}!`],
    [/^(\S+) s'arrête \((.+)\) — ([\d.]+) s · (.+)$/, (m, a, r, s, t) => `${a} pits (${w(r)}) — ${s} s · ${w(t)}`],
    [/^FAUX DÉPART de (\S+) : pénalité de 5 s$/, 'JUMP START by $1: 5 s penalty'], [/^Mauvais départ de (\S+) !$/, 'Bad start for $1!'],
    [/^Temps de réaction de (\S+) : (.+)$/, '$1 reaction time: $2'], [/^Blocage de roues pour (\S+) !$/, '$1 locks up!'],
    [/^(\S+) ferme la porte sur (\S+) !$/, '$1 shuts the door on $2!'], [/^PÉNALITÉ de 5 s pour (\S+) : limites de piste \((\d+) infractions\)$/, '5 s PENALTY for $1: track limits ($2 offences)'],
    [/^Limites de piste pour (\S+) \((.+?)\)( · drapeau noir et blanc)?$/, (m, a, b, f) => `Track limits for ${a} (${b})${f ? ' · black and white flag' : ''}`],
    [/^PÉNALITÉ de 5 s pour (\S+) : collisions répétées \((\d+)\)$/, '5 s PENALTY for $1: repeated collisions ($2)'], [/^Contact entre (\S+) et (\S+)$/, 'Contact between $1 and $2'],
    [/^(\S+) touche la voiture arrêtée( — museau endommagé)?$/, (m, a, n) => `${a} hits the stopped car${n ? ' — nose damaged' : ''}`], [/^(\S+) frôle la voiture arrêtée$/, '$1 brushes the stopped car'],
    [/^Contact (\S+) \/ (\S+) — aileron endommagé pour (\S+)$/, 'Contact $1 / $2 — wing damaged for $3'], [/^Léger contact entre (\S+) et (\S+)$/, 'Light contact between $1 and $2'],
    [/^ACCROCHAGE entre (\S+) et (\S+) !$/, 'COLLISION between $1 and $2!'], [/^CRASH ! (\S+) et (\S+) s'accrochent violemment$/, 'CRASH! $1 and $2 collide hard'],
    [/^DRAPEAU À DAMIER ! (.+) remporte le Grand Prix !$/, 'CHEQUERED FLAG! $1 wins the Grand Prix!'],
    [/^(\S+) : gros choc, mais (tu repars|repart) !?$/, (m, a, b) => `${a}: big hit, but ${b === 'tu repars' ? 'you keep going' : 'carries on'}!`],
    [/^(\S+) passe (.+) · P(\d+)( · mode Overtake)?$/, (m, a, b, p, o) => `${a} passes ${b.replace(/ et /g, ' and ')} · P${p}${o ? ' · Overtake mode' : ''}`],
    [/^(\S+) dans les échappements de (\S+) · P(\d+)$/, '$1 right on $2’s gearbox · P$3'], [/^(\S+) passe devant (\S+) grâce aux stands$/, '$1 gets ahead of $2 thanks to the pit stop'],
    [/^(\S+) reste en piste et ressort devant (\S+)$/, '$1 stays out and comes out ahead of $2'], [/^(\S+) en tête : (\S+) est aux stands$/, '$1 leads: $2 is in the pits'],
    [/^(\S+) prend la tête devant (\S+)$/, '$1 takes the lead from $2'], [/^(\S+) enchaîne (\d+) dépassements$/, '$1 makes $2 overtakes in a row'],
    [/^(\S+) · P(\d+) · à ([\d.]+) s de (\S+)$/, '$1 · P$2 · $3 s behind $4'], [/^(\S+) · P(\d+) · en tête$/, '$1 · P$2 · leading'],
    [/^(.+) · (\d+) tours$/, '$1 · $2 laps'], [/^(\d+) arrêts?(.*)$/, (m, n, r) => `${n} stop${n > 1 ? 's' : ''}${r.replace(' s du leader', ' s to leader')}`],
    [/^(.+) · (\d+) tours · (\d+) km$/, '$1 · $2 laps · $3 km'], [/^Tour (\d+)\/(\d+)$/, 'Lap $1/$2'],
    [/^(\S+) · ([\d.]+) s · (.+)$/, (m, a, b, c) => `${a} · ${b} s · ${w(c)}`], [/^Pilote n°(\d+)(.*)$/, 'Driver #$1$2'],
    [/^Pénalité de 5 s toutes les (\d+) (infractions|collisions provoquées) \((limites de piste|collisions)\)\.$/, (m, n, u, l) => `5 s penalty every ${n} ${u === 'infractions' ? 'offences' : 'collisions caused'} (${l === 'collisions' ? 'collisions' : 'track limits'}).`],
    [/^Pas de pénalité pour les (limites de piste|collisions)\.$/, (m, l) => `No penalty for ${l === 'collisions' ? 'collisions' : 'track limits'}.`],
    [/^Duel pour la P(\d+) : (\S+) attaque (\S+)$/, 'Battle for P$1: $2 attacks $3'], [/^(\S+) aux stands$/, '$1 in the pits'], [/^Tête de course$/, 'Race leader'],
    [/^Dernier tour : (.+) vers la victoire$/, 'Final lap: $1 heading for victory'], [/^(\S+) vainqueur$/, '$1 wins'], [/^(.+) vers la P(\d+)$/, '$1 heading for P$2'],
    [/^(\d+)\/(\d+) circuits avec un record — il en manque (\d+) pour le total complet( \(total partiel\))?\.$/, (m, a, b, c, d) => `${a}/${b} circuits with a record — ${c} missing for the full total${d ? ' (partial total)' : ''}.`],
    [/^Contre-la-montre (hybride|thermique) · temps total (\d+) circuits$/, (m, e, n) => `${e === 'hybride' ? 'Hybrid' : 'Combustion'} time trial · total time ${n} circuits`],
    [/^Records sur (\d+)\/(\d+) circuits$/, 'Records on $1/$2 circuits'], [/^Record : (.+)$/, 'Record: $1'], [/^total (.+)$/, 'total $1'],
    [/^Pilote estimé (\d+)e sur (\d+) en talent$/, 'Driver ranked #$1 of $2 for talent'], [/^Coéquipier estimé (\d+)e sur (\d+) en talent$/, 'Teammate ranked #$1 of $2 for talent'],
    [/^Voiture estimée (1re|\d+e) sur (\d+)$/, (m, a, n) => `Car ranked #${parseInt(a)} of ${n}`], [/^une voiture de podium\.$/, 'a podium car.'],
    [/^de quoi jouer les victoires… et la pression qui va avec\.$/, 'good enough to fight for wins… and the pressure that comes with it.'],
    [/^de quoi viser les points chaque week-end\.$/, 'good enough to aim for points every weekend.'], [/^marquer des points sera déjà une victoire\.$/, 'scoring points will already be a victory.'],
    [/^(P\d+ → P\d+) · tous ses dépassements et ses arrêts$/, '$1 · all their overtakes and stops'], [/^★ Pilote du jour$/, '★ Driver of the day'],
    [/^(\d+) évolution\(s\) apportée\(s\) pour ce GP( · gros packages)?$/, (m, n, b) => `${n} upgrade(s) for this GP${b ? ' · big packages' : ''}`],
    [/^manche (\d+)\/(\d+) — leader : (.+)$/, 'round $1/$2 — leader: $3'], [/^manche (\d+)$/, 'round $1'], [/^météo : (.+)$/, (m, x) => `weather: ${w(x)}`],
    [/^(.+) : (.+) \(ratée\)$/, '$1: $2 (failed)'], [/^régularité (\d+)$/, 'consistency $1'], [/^Ton écurie$/, 'Your team'], [/^Ton pilote$/, 'Your driver'], [/^moteur (.+)$/, 'engine $1'],
    [/^\+([\d,]+) s au tour$/, '+$1 s per lap'], [/^dégradation (très élevée|élevée|moyenne|faible|très faible)$/, (m, x) => 'degradation ' + ({ 'très élevée': 'very high', 'élevée': 'high', 'moyenne': 'medium', 'faible': 'low', 'très faible': 'very low' })[x]],
    [/^(.+) \((aéro|moteur \/ traînée|gestion pneus)\) : −([\d,]+) s au tour$/, (m, p, a, x) => `${tr(p)} (${tr(a)}): −${x} s per lap`],
    [/^(.+) \((aéro|moteur \/ traînée|gestion pneus)\) (— .+)$/, (m, p, a, x) => `${tr(p)} (${tr(a)}) ${tr(x.replace(/ \([+−-][\d.]+\)$/, ''))}${(/ \([+−-][\d.]+\)$/.exec(x) || [''])[0]}`],
    [/^(\d+) km · (\d+) tours( · urbain)?$/, (m, a, b, u) => `${a} km · ${b} laps${u ? ' · street' : ''}`], [/^([\d.]+ km) · (\d+) tours( · urbain)?$/, (m, a, b, u) => `${a} · ${b} laps${u ? ' · street' : ''}`],
    [/^IA (.+)$/, 'AI $1'], [/^Carrière (\d+)$/, 'Career $1'], [/^(\d+) abandon\(s\)$/, '$1 retirement(s)'], [/^meilleur tour (.+)$/, 'fastest lap $1'],
    [/^([^:·]+) : ([^:·]+)$/, (m, a, b) => `${tr(a)}: ${tr(b)}`], [/^Saison (\d+) →$/, 'Season $1 →'], [/^▶ Reprendre la course · tour (\d+)\/(\d+)$/, '▶ Resume the race · lap $1/$2'],
  ];
  const core = /^([^\p{L}\p{N}«“"]*)([\s\S]*?)([\s!?.:…]*)$/u;
  function trRaw(s) {
    const e = EN.get(s); if (e != null) return e;
    for (const [re, rep] of PAT) if (re.test(s)) return s.replace(re, rep);
    return null;
  }
  /* traduction d'un texte (français → anglais) ; en français, le texte est rendu tel quel */
  function tr(s) {
    if (lang !== 'en' || s == null || s === '') return s;
    s = String(s);
    let r = trRaw(s); if (r != null) return r;
    const t = s.trim(); if (t !== s) { r = trRaw(t); if (r != null) return s.replace(t, r); }
    const m = core.exec(t);
    if (m && (m[1] || m[3]) && m[2]) { r = trRaw(m[2]); if (r != null) return s.replace(m[2], r); }
    // texte composé : segments séparés par « · » ou phrases, traduits un à un
    for (const sep of [' · ', ' — ']) if (t.includes(sep)) { const parts = t.split(sep), out = parts.map(x => tr(x)); if (out.some((x, i) => x !== parts[i])) return s.replace(t, out.join(sep)); }
    const sen = t.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖÉ«])/);
    if (sen.length > 1) { const out = sen.map(x => tr(x)); if (out.some((x, i) => x !== sen[i])) return s.replace(t, out.join(' ')); }
    return s;
  }
  const L = (fr, en) => lang === 'en' ? en : fr;

  /* ---- traduction automatique de la page ---- */
  const orig = new WeakMap(), done = new WeakMap();
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']);
  const ATTRS = ['aria-label', 'placeholder', 'title'];
  const hasLetters = /[A-Za-zÀ-ÿ]{2}/;
  function trText(n) {
    const p = n.parentNode; if (!p || SKIP.has(p.nodeName) || (p.closest && p.closest('[data-noi18n]'))) return;
    const d = n.data;
    if (done.get(n) === d || !hasLetters.test(d)) return;
    const r = tr(d);
    if (r !== d) { orig.set(n, d); done.set(n, r); n.data = r; }
  }
  function trAttrs(el) {
    if (!el.getAttribute) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a); if (!v || el.dataset['i18n' + a.replace('-', '')] === v) continue;
      const r = tr(v);
      if (r !== v) { el.dataset['i18nfr' + a.replace('-', '')] = v; el.dataset['i18n' + a.replace('-', '')] = r; el.setAttribute(a, r); }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { trText(root); return; }
    if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
    trAttrs(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = it.nextNode(); n; n = it.nextNode()) { if (n.nodeType === 3) trText(n); else trAttrs(n); }
  }
  function restore(root) {
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = it.nextNode(); n; n = it.nextNode()) {
      if (n.nodeType === 3) { if (orig.has(n) && done.get(n) === n.data) n.data = orig.get(n); orig.delete(n); done.delete(n); }
      else for (const a of ATTRS) { const k = a.replace('-', ''), fr = n.dataset && n.dataset['i18nfr' + k]; if (fr != null) { if (n.getAttribute(a) === n.dataset['i18n' + k]) n.setAttribute(a, fr); delete n.dataset['i18nfr' + k]; delete n.dataset['i18n' + k]; } }
    }
  }
  let obs = null;
  function observe(on) {
    if (on && !obs) {
      obs = new MutationObserver(list => {
        for (const m of list) {
          if (m.type === 'characterData') trText(m.target);
          else if (m.type === 'attributes') trAttrs(m.target);
          else for (const n of m.addedNodes) walk(n);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    } else if (!on && obs) { obs.disconnect(); obs = null; }
  }
  function set(l) {
    lang = l === 'en' ? 'en' : 'fr';
    document.documentElement.lang = lang;
    if (!document.body) return;
    if (lang === 'en') { walk(document.body); observe(true); }
    else { observe(false); restore(document.body); }
  }
  return { tr, L, set, get lang() { return lang; } };
})();
const tr = I18N.tr, L = I18N.L;
