export type SafetyCategory = 'threats_violence' | 'self_harm' | 'sexual_content' | 'personal_info'

export type ModerationDecision = {
  category: SafetyCategory | null
  confidence: number
}

export type ReportTriage = {
  category: string
  confidence: number
  summary: string
}

// Keyword-based moderation patterns (expandable, no external API)
const THREAT_PATTERNS = [
  // Direct threats
  /\b(kill|murder|assassinate|execute|slaughter|massacre)\s+(you|yourself|him|her|them|everyone|all|people|family)\b/i,
  /\b(i\s+will|i'm\s+going\s+to|im\s+going\s+to|i\s+plan\s+to|i\s+intend\s+to|i\s+am\s+going\s+to)\s+(kill|murder|hurt|harm|destroy|attack|stab|shoot|beat|strangle|choke|maim|torture|eliminate)\b/i,
  /\b(death\s+threat|bomb\s+threat|shooting|stabbing|drive.by|drive-by|mass\s+shooting|school\s+shooting)\b/i,
  /\b(find\s+where\s+you\s+live|come\s+to\s+your\s+(house|home|address)|show\s+up\s+at|track\s+you\s+down|hunt\s+you|locate\s+you)\b/i,
  /\b(i\s+know\s+where\s+you|your\s+address|your\s+location|dox|doxx|swat|swatting)\b/i,
  /\b(beat\s+you\s+up|jump\s+you|fuck\s+you\s+up|mess\s+you\s+up|destroy\s+you|wreck\s+you|ruin\s+you)\b/i,
  /\b(violence|violent|harm|dangerous|threaten|intimidate|terrorize)\s+(you|them|her|him|us)\b/i,
  /\b(wish\s+you\s+(were\s+)?dead|hope\s+you\s+die|should\s+die|deserve\s+to\s+die|die\s+in\s+a\s+fire|go\s+die)\b/i,
  /\b(cut\s+your\s+throat|slit\s+your|gut\s+you|decapitate|behead|dismember)\b/i,
  /\b(arson|burn\s+(down|your|the)\s+(house|building|place|home))\b/i,
  // Weapon references in threat context
  /\b(gun|knife|weapon|firearm|rifle|pistol|shotgun|machete|axe|bat|hammer)\s+(to|for|against)\s+(you|them|her|him)\b/i,
  // Stalking/harassment escalation
  /\b(stalk|stalking|follow\s+you\s+home|watch\s+your\s+(house|home)|wait\s+outside)\b/i,
  // Kidnapping/abduction
  /\b(kidnap|abduct|take\s+you\s+away|hold\s+you\s+hostage|capture\s+you)\b/i,
  // Extortion/blackmail
  /\b(blackmail|extort|ransom|pay\s+me\s+or|do\s+what\s+i\s+say\s+or)\b/i,
]

const SELF_HARM_PATTERNS = [
  // Direct self-harm intent
  /\b(i\s+want\s+to\s+(kill|hurt)\s+myself|suicide|kill\s+myself|ending\s+it\s+all)\b/i,
  /\b(end\s+my\s+life|take\s+my\s+own\s+life|don't\s+want\s+to\s+live|want\s+to\s+die)\b/i,
  /\b(cutting|overdose|hanging\s+myself|pills|razor|blade|noose|carbon\s+monoxide|helium|exit\s+bag)\b/i,
  /\b(self.harm|self.hurt|cutting\s+myself|hurting\s+myself|self.injury|self.mutilation)\b/i,
  /\b(ready\s+to\s+die|done\s+with\s+life|can't\s+go\s+on|nothing\s+left|no\s+reason\s+to\s+live)\b/i,
  /\b(plan\s+to\s+(kill|hurt)\s+myself|method|means|access\s+to|how\s+to\s+(kill|hurt)\s+myself)\b/i,
  /\b(goodbye\s+(forever|world|everyone)|final\s+(message|post|goodbye)|last\s+(message|post|words))\b/i,
  // Eating disorder crisis
  /\b(starving\s+myself|won't\s+eat|refuse\s+to\s+eat|purge\s+everything|laxative\s+overdose)\b/i,
  // Substance overdose intent
  /\b(overdose\s+on|take\s+all\s+(pills|medication)|drink\s+bleach|drink\s+drano)\b/i,
]

const PERSONAL_INFO_PATTERNS = [
  /(?<!\d)(?:\+?\d{1,3}[\s-]*)?(\d{3}[\s-]*){2}\d{4}(?!\d)/,
  /\b\d{1,5}\s+[A-Za-z]+(?:\s+[A-Za-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Square|Sq|Terrace|Ter|Trail|Trl|Parkway|Pkwy|Circle|Cir|Highway|Hwy|Expressway|Expy|Way|Walk|Alley|Ally)(?:\s+(?:Apt|Unit|#)\s*\d{1,4}[A-Z]?)?\b/i
]


const SEXUAL_CONTENT_PATTERNS = [
  // CSAM / minor sexual content
  /\b(cp|child\s+porn|minor\s+sexual|underage\s+sex|child\s+sexual|pedo|paedo|predator|pedophile|hebephile|ephebophile)\b/i,
  /\b(rape|sexual\s+assault|molest|abuse|exploit)\s+(child|minor|kid|teen|youth|boy|girl|student)\b/i,
  /\b(preteen|pre.teen|young\s+(girl|boy|teen)|lolita|shota|toddler|infant|baby|child)\s+(sex|sexual|nude|naked|porn)\b/i,
  // Explicit sexual content (general)
  /\b(rape|sexual\s+assault|molest|nude|naked|sex\s+tape|revenge\s+porn|deepfake\s+porn|nude\s+leak)\b/i,
  // Sexual exploitation
  /\b(onlyfans|premium\s+snap|private\s+show|cam\s+show|sextort|sextortion|nudes\s+for)\b/i,
  // Incest
  /\b(incest|family\s+sex|mother.son|father.daughter|brother.sister|sister.brother)\b/i,
  // Bestiality
  /\b(bestiality|zoophilia|animal\s+sex|dog\s+sex|horse\s+sex)\b/i,
  // Grooming / inappropriate adult-to-minor requests - English
  /\b(send\s+me\s+(a\s+)?(pic|picture|photo|selfie|nude|naked|hot|sexy))\b/i,
  /\b(send\s+(me\s+)?(a\s+)?(pic|picture|photo|selfie|nude|naked|hot|sexy)\s+(of\s+)?(your\s+)?(body|breast|boobs|tits|ass|butt|pussy|vagina|penis|dick|cock))\b/i,
  /\b(send\s+(me\s+)?(a\s+)?(pic|picture|photo|selfie)\s+(in\s+)?(your\s+)?(underwear|bra|panties|swimsuit|bikini|little\s+clothing))\b/i,
  /\b(meet\s+me\s+(in\s+)?(person|real\s+life)|meet\s+up|hook\s+up|get\s+together)\b/i,
  /\b(come\s+over|come\s+to\s+my\s+(place|house|home|apartment|room)|invite\s+you\s+over)\b/i,
  /\b(keep\s+(this\s+)?(between\s+us|secret|private|just\s+us|our\s+little\s+secret)|don'?t\s+tell\s+(anyone|parents|mom|dad|family|friends|teacher|police))\b/i,
  /\b(you\'?re\s+so\s+(hot|sexy|beautiful|gorgeous|attractive|cute|pretty|hot|fine)|you\'?re\s+(looking|looking\s+like)\s+(sexy|hot|fine))\b/i,
  /\b(take\s+off\s+(your\s+)?(clothes|shirt|pants|top|bottom|underwear|bra|panties)|get\s+naked|strip\s+for\s+me)\b/i,
  /\b(touch\s+(yourself|your\s+?\w+\s*)|play\s+with\s+yourself|masturbate\s+for\s+me|show\s+me\s+how\s+you\s+(touch|play\s+with))\b/i,
  /\b(what\s+are\s+you\s+wearing|what\s+do\s+you\s+look\s+like\s+naked|describe\s+your\s+body|tell\s+me\s+about\s+your\s+(breasts|boobs|tits|ass|butt|pussy|vagina|penis|dick|cock))\b/i,
  /\b(do\s+you\s+watch\s+porn|have\s+you\s+ever\s+(had\s+sex|been\s+kissed|touched\s+in\s+a\s+private\s+place)|how\s+old\s+were\s+you\s+when\s+you\s+(first\s+)?(had\s+sex|been\s+kissed))\b/i,
  /\b(i\s+can\s+teach\s+you\s+about\s+sex|let\s+me\s+show\s+you\s+how\s+to\s+(kiss|touch|please\s+someone)|i\s+know\s+things\s+about\s+your\s+body\s+you\s+don'?t\s+know)\b/i,
  /\b(private\s+chat|go\s+private|direct\s+message|dm\s+me|whisper|just\s+between\s+us|voice\s+call|video\s+call|facetime|snapchat|instagram|whatsapp|kik)\b/i,
  /\b(i\s+have\s+(a\s+)?(gift|present|money|cash|game\s+codes|itunes\s+card|amazon\s+card|robux|vbucks|gift\s+card)\s+for\s+you|i\'?ll\s+buy\s+you\s+(anything|whatever\s+you\s+want))\b/i,
  /\b(lie\s+about\s+your\s+age|say\s+you\'?re\s+older|don'?t\s+say\s+how\s+old\s+you\s+are|keep\s+your\s+age\s+a\s+secret|your\s+parents\s+won'?t\s+believe\s+how\s+old\s+you\s+are)\b/i,
  // Grooming / inappropriate adult-to-minor requests - Spanish
  /\b(enviame\s+(una\s+)?(foto|fotito|pic|picture|photo|selfie|desnuda|desnudo|sexy|hot))\b/i,
  /\b(enviami\s+(una\s+)?(foto|fotito|pic|picture|photo|selfie|desnuda|desnudo|sexy|hot))\b/i,
  /\b(send\s+me\s+(una\s+)?(foto|fotito|pic|picture|photo|selfie|desnuda|desnudo|sexy|hot))\b/i,
  /\b(envíame\s+(una\s+)?(foto|fotito|pic|picture|photo|selfie|desnuda|desnudo|sexy|hot))\b/i,
  /\b(envíami\s+(una\s+)?(foto|fotito|pic|picture|photo|selfie|desnuda|desnudo|sexy|hot))\b/i,
  /\b(mándame\s+(una\s+)?(foto|fotito|pic|picture|photo|selfie|desnuda|desnudo|sexy|hot))\b/i,
  /\b(manda\s+me\s+(una\s+)?(foto|fotito|pic|picture|photo|selfie|desnuda|desnudo|sexy|hot))\b/i,
  /\b(mírame\s+desnudo|mírame\s+desnuda|muéstrame\s+tu\s+cuerpo|muéstrame\s+desnudo|muéstrame\s+desnuda)\b/i,
  /\b(qué\s+estás\s+usando|qué\s+tienes\s+puesto|descríbeme\s+tu\s+cuerpo|dime\s+qué\s+tienes\s+puesto)\b/i,
  /\b(qué\s+carne\s+tienes|dime\s+de\s+tu\s+cuerpo|dime\s+cómo\s+eres\s+desnudo)\b/i,
  /\b(ven\s+aca|ven\s+para\s+acá|ven\s+para\s+aquí|ven\s+a\s+mi\s+casa|ven\s+a\s+verme)\b/i,
  /\b(queremos\s+estar\s+solos|queremos\s+estar\s+sol@s|queremos\s+estar\s+a\s+solas|no\s+le\s+digas\s+a\s+nadie)\b/i,
  /\b(no\s+le\s+digas\s+a\s+tus\s+padres|no\s+le\s+digas\s+a\s+tu\s+mamá|no\s+le\s+digas\s+a\s+tu\s+papá)\b/i,
  /\b(guardalo\s+entre\s+nosotros|esto\s+es\s+nuestro\s+secreto|esto\s+queda\s+entre\s+nosotros)\b/i,
  /\b(eres\s+muy\s+guapo|eres\s+muy\s+guapa|eres\s+muy\s+lindo|eres\s+muy\s+linda|eres\s+muy\s+sexy)\b/i,
  /\b(eres\s+atractivo|eres\s+atractiva|te\s+ves\s+guapo|te\s+ves\s+guapa|te\s+ves\s+sexy)\b/i,
  /\b(quítate\s+la\s+camisa|quítate\s+los\s+pantalones|quítate\s+la\s+ropa|desnúdete)\b/i,
  /\b(tócate|juega\s+contigo\s+mismo|masturbate\s+para\s+mí|muéstrame\s+cómo\s+te\s+tocas)\b/i,
  /\b(chat\s+privado|conversación\s+privada|dm\s+me|mensaje\s+directo|hablar\s+solos)\b/i,
  /\b(tengo\s+un\s+regalo\s+para\s+ti|tengo\s+un\s+premio\s+para\s+ti|te\s+doy\s+algo\s+si\s+haces\s+esto)\b/i,
  /\b(mentir\s+sobre\s+tu\s+edad|decir\s+que\s+eres\s+mayor|no\s+decir\s+tu\s+edad|guardar\s+tu\s+edad\s+en\s+secreto)\b/i,
  // Grooming / inappropriate adult-to-minor requests - French
  /\b(envoie\s+moi\s+(une\s+)?(photo|pic|picture|selfie|nue|nu|sexy|hot))\b/i,
  /\b(envoies\s+moi\s+(une\s+)?(photo|pic|picture|selfie|nue|nu|sexy|hot))\b/i,
  /\b(envoiez\s+moi\s+(une\s+)?(photo|pic|picture|selfie|nue|nu|sexy|hot))\b/i,
  /\b(envoie\s+moi\s+(une\s+)?(photo|pic|picture|selfie|nue|nu|sexy|hot)\s+(de\s+)?(ton\s+)?(corps|seins|poitrine|fesses|cul|vagin|pénis|sexe))\b/i,
  /\b(montre\s+moi\s+ton\s+corps|montre\s+moi\s+tes\s+seins|montre\s+moi\s+ton\s+nu|décris\s+moi\s+ton\s+corps)\b/i,
  /\b(qu\'est-ce\s+que\s+tu\s+portes|qu\'est-ce\s+que\s+tu\s+as\s+mis|décris\s+moi\s+ton\s+corps|dis-moi\s+ce\s+que\s+tu\s+portes)\b/i,
  /\b(viens\s+ici|viens\s+près\s+de\s+moi|viens\s+à\s+ma\s+maison|rencontrons-nous\s+en\s+personne)\b/i,
  /\b(gardons\s+ça\s+entre\s+nous|gardons\s+ça\s+secret|ne\s+le\s+dis\s+à\s+personne|ne\s+le\s+dis\s+pas\s+à\s+tes\s+parents)\b/i,
  /\b(tres\s+beau|tres\s+belle|tres\s+sexy|tres\s+hot|tu\s+es\s+beau|tu\s+es\s+belle|tu\s+es\s+sexy)\b/i,
  /\b(tu\s+es\s+mignon|tu\s+es\s+mignonne|tu\s+es\s+canon|tu\s+es\s+ravissant)\b/i,
  /\b(enlève\s+ton\s+chemise|enlève\s+ton\s+pantalon|enlève\s+tes\s+vêtements|met-toi\s+nu)\b/i,
  /\b(touche-toi|joue\s+avec\s+toi-même|masturbe-toi\s+pour\s+moi|montre-moi\s+comment\s+tu\s+te\s+touches)\b/i,
  /\b(chat\s+privé|conversation\s+privée|message\s+direct|dm\s+me|parlons\s+en\s+privé)\b/i,
  /\b(j\'ai\s+un\s+cadeau\s+pour\s+toi|j\'ai\s+un\s+cadeau\s+pour\s+toi|je\s+te\s+donnerai\s+quelque\s+chose)\b/i,
  /\b(mentir\s+sur\s+ton\s+âge|dire\s+que\s+tu\s+es\s+majeur|ne\s+pas\s+dire\s+ton\s+âge|garder\s+ton\s+âge\s+secret)\b/i,
]

function checkPatterns(text: string, patterns: RegExp[]): boolean {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ')
  return patterns.some((p) => p.test(normalized))
}

async function moderateWithKeywords(text: string): Promise<ModerationDecision> {
  // Quick checks first
  if (checkPatterns(text, THREAT_PATTERNS)) {
    return { category: 'threats_violence', confidence: 0.95 }
  }
  if (checkPatterns(text, SELF_HARM_PATTERNS)) {
    return { category: 'self_harm', confidence: 0.95 }
  }
  if (checkPatterns(text, SEXUAL_CONTENT_PATTERNS)) {
    return { category: 'sexual_content', confidence: 0.95 }
  }
  if (checkPatterns(text, PERSONAL_INFO_PATTERNS)) {
    return { category: 'personal_info', confidence: 0.95 }
  }
  return { category: null, confidence: 0 }
}

// Primary: keyword-based only (no external API dependency)
export async function moderateSafetyText(text: string): Promise<ModerationDecision> {
  return moderateWithKeywords(text)
}

export async function triageUserReport(category: string, details: string): Promise<ReportTriage> {
  // Keyword-based triage (no external API)
  const keywordResult = await moderateWithKeywords(details)
  const resolvedCategory = keywordResult.category ?? category ?? 'other'

  return {
    category: resolvedCategory,
    confidence: keywordResult.confidence > 0 ? keywordResult.confidence : 0.5,
    summary: category ? `Automated keyword triage for ${category}` : 'Automated keyword triage',
  }
}

export function moderationModelName(): string {
  return 'keyword-only'
}