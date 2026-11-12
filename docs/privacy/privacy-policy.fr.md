# Pievra — politique de confidentialité

Version 1.1 pour la version 0.1.0 de l'extension, 12 novembre 2026. Elle prend effet à la publication de l'extension. En cas de divergence, la version anglaise (`privacy-policy.md`) fait référence jusqu'à relecture juridique de cette traduction.

Éditeur et responsable de traitement pour ce qui est décrit ici : MRNIE SAS, 16 rue du Dragon, 75006 Paris, France — RCS Paris 109 701 664. Contact vie privée : dpo@mrnie.com. Contact général : contact@pievra.com.

## En un paragraphe

Pievra fonctionne entièrement dans votre navigateur. Il n'a ni serveur, ni compte, ni mesure d'audience. L'éditeur ne reçoit de l'extension aucune donnée sur vous, votre navigation ou vos choix, car l'extension n'en envoie aucune. Rien ne parvient à l'éditeur, sauf si vous décidez de le lui envoyer vous-même par courriel (voir plus bas). Tout ce qu'elle mémorise est enregistré dans votre navigateur, sur votre appareil, et vous pouvez l'exporter ou le supprimer à tout moment.

## Ce que Pievra enregistre sur votre appareil

| Quoi | Pourquoi | Combien de temps |
|---|---|---|
| Votre choix par défaut (refuser ou autoriser) pour six finalités, et l'état du signal Global Privacy Control | Appliquer vos choix | Jusqu'à modification ou suppression |
| Pour chaque site où un produit de bandeau cookies reconnu a été trouvé, ou pour lequel vous avez fait un choix : le domaine du site (par exemple `exemple.fr`), vos choix, la mise en pause éventuelle | Se souvenir du site | Jusqu'à l'oubli du site ou la suppression de tout |
| Pour ces mêmes sites : le résultat (par exemple « refusé et confirmé »), le nom du produit de bandeau, de courtes lignes de preuve, les dates de la dernière tentative et de la dernière confirmation | Vous montrer ce qui s'est passé et sur quelle base | Idem |
| Pour ces mêmes sites : le résultat de six contrôles techniques et, pour deux d'entre eux, jusqu'à 10 noms de services de suivi issus d'une liste incluse dans l'extension | Vous montrer l'audit technique | Supprimé automatiquement après 90 jours |

Non enregistré : les sites sans bandeau reconnu et sans choix de votre part ; les adresses web au-delà du domaine ; les titres ou contenus de pages ; les noms ou valeurs de cookies ; ce que vous saisissez.

Rien n'est copié vers votre compte de navigateur : le stockage synchronisé n'est jamais utilisé.

## Ce qui quitte votre appareil

L'extension n'envoie rien à MRNIE ni à un tiers. Elle n'émet aucune requête réseau de sa propre initiative. Ce point est contrôlé à chaque construction par une capture automatisée et par l'inspection des fichiers livrés.

Deux éléments modifient ce que les sites reçoivent eux-mêmes de votre navigateur :

1. **Votre refus.** Pievra actionne les commandes de refus du bandeau du site, comme vous le feriez. Le site apprend ce que lui apprend le refus de tout visiteur.
2. **Global Privacy Control**, activé par défaut. Chaque requête vers un site non mis en pause porte l'en-tête `Sec-GPC: 1`, et les pages peuvent lire le même signal. Il s'agit d'un bit, identique pour toutes les personnes qui l'activent, sans identifiant. Il peut rendre votre navigateur légèrement plus distinguable d'un navigateur qui ne l'envoie pas. Vous pouvez le désactiver dans les réglages.

## Si vous choisissez de nous envoyer un fichier de résultats

La version 0.1.0 est une première version de test. Ses pages d'accueil et de résultats vous invitent à aider en envoyant un fichier de résultats à contact@pievra.com. C'est facultatif, et l'extension n'envoie jamais ce fichier elle-même : vous le téléchargez et vous l'envoyez.

| | |
|---|---|
| Ce que nous recevons | Votre adresse électronique et ce que votre messagerie y ajoute ; le fichier. Avec « noms des sites » : les domaines des sites où un bandeau reconnu a été trouvé, le résultat et les éléments vérifiés pour chacun, la version de votre navigateur, vos langues et votre fuseau horaire. Sans : la même chose, les sites étant numérotés au lieu d'être nommés, sans langues ni fuseau horaire |
| Pourquoi | Uniquement pour trouver et corriger les sites où Pievra échoue, et compter la fréquence à laquelle il fonctionne |
| Base légale | Votre consentement, donné par l'envoi du fichier. Vous pouvez le retirer en écrivant à dpo@mrnie.com ; nous supprimons alors le fichier et votre message |
| Qui y accède | MRNIE SAS et son prestataire de messagerie. Rien n'est vendu, partagé ni publié. Les chiffres que nous publions à partir de ces fichiers sont des totaux (par exemple « 41 bandeaux traités sur 50 »), jamais la liste de sites d'une personne |
| Durée | Suppression au plus tard 6 mois après réception |

Si vous préférez ne pas montrer où vous êtes allé, utilisez « Download without site names », ou n'envoyez rien : l'extension fonctionne exactement de la même façon.

## Autorisations et usages

| Autorisation | Usage |
|---|---|
| Accès à tous les sites | Un bandeau cookies peut apparaître sur n'importe quel site ; l'extension doit y être présente pour le reconnaître et y répondre |
| Stockage | Conserve dans votre navigateur les données listées ci-dessus |
| Scripting | Demande à l'outil de consentement du site ce qu'il a enregistré, et expose le signal Global Privacy Control aux pages |
| Declarative net request (avec accès aux hôtes) | Ajoute l'en-tête `Sec-GPC: 1`. Ne bloque ni ne redirige rien |
| Web request (observation seule) | Permet à l'audit technique de voir quels services de suivi listés une page contacte. Ne peut ni bloquer ni modifier une requête ; seul le nom du service est conservé |

## Vos moyens de contrôle

Dans les réglages, vous pouvez : modifier chaque choix ; mettre Pievra en pause sur un site ; oublier un site, plusieurs, ou tous ; exporter vos choix dans un fichier ; tout supprimer. La désinstallation de l'extension supprime toutes ses données du navigateur.

MRNIE ne détenant aucune donnée vous concernant, elle n'a rien à communiquer, rectifier ou effacer de son côté. Pour toute question sur cette politique, ou pour exercer un droit au titre du RGPD, écrivez à dpo@mrnie.com. Vous pouvez aussi saisir votre autorité de protection des données (en France, la CNIL).

## Statistiques et télémétrie

Aucune. Le code source contient la conception de statistiques facultatives, agrégées, soumises à accord préalable. Elle est désactivée, absente de l'extension livrée, sans serveur destinataire, et son usage n'a pas été approuvé. Si cela devait changer, cette politique changerait d'abord, et rien ne serait collecté sans votre accord explicite. Rien ne sera jamais collecté sur la période antérieure à cet accord.

## Ce que signifient les résultats

« Confirmé » signifie que l'outil de consentement du site indique avoir enregistré votre refus. Ce n'est pas la preuve que tout suivi a cessé, ni une conclusion juridique sur un site. L'audit technique rapporte des observations par rapport à une liste incluse de 65 services de suivi ; ce n'est pas une évaluation de conformité.

## Enfants

Pievra est un outil généraliste de protection de la vie privée ; il ne s'adresse pas aux enfants. Il ne collecte de données sur personne.

## Modifications

Les modifications figurent dans le journal des changements du projet et prennent effet avec la version qui les porte. Toute modification conduisant des données à quitter votre appareil exigerait d'abord votre accord.

## Logiciel libre

Le code source est sous licence Mozilla Public License 2.0 et public à l'adresse https://github.com/pievra/consent-memory : ces affirmations sont vérifiables.
