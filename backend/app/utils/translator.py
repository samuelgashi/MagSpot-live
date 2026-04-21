
# ----------------------------------
# ------- VERSION 2.0 TRANSLATORS
# ----------------------------------

from deep_translator import GoogleTranslator

langs = ["de", "fr", "es", "pt", "it", "sv", "cs", "pl", "nl", "el"]



# def to_lower_conditions(translations: list[str], AttrType="@text", do_lower_case=True, do_translate=True) -> str:
#     """
#     Build case-insensitive XPath OR conditions from a list of translated words.
#     Each word is compared using translate() + contains() for fuzzy matching.
#     Returns only the OR conditions string, not the full XPath.
#     """
#     conditions = []
#     for word in translations:
#         word_lower = word.lower() if do_lower_case else word
#         cond = f"""contains(translate({AttrType},"ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖÜÇÉÈÑØÆŒŠŽĐĆČ","abcdefghijklmnopqrstuvwxyzåäöüçéèñøæœšžđćč"),"{word_lower}")""" if do_translate else f"""contains({AttrType}, "{word_lower}")"""
#         conditions.append(cond)
#     return " or ".join(conditions)


def to_lower_conditions(translations: list[str], AttrType="@text", do_lower_case=True, do_translate=True, is_not_cond=False) -> str:
    
    conditions = []
    for word in translations:
        word_lower = word.lower() if do_lower_case else word
        if do_translate:
            cond = f"""contains(translate({AttrType},"ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖÜÇÉÈÑØÆŒŠŽĐĆČ","abcdefghijklmnopqrstuvwxyzåäöüçéèñøæœšžđćč"),"{word_lower}")"""
        else: cond = f"""contains({AttrType}, "{word_lower}")"""
        if is_not_cond: cond = f"not({cond})"
        conditions.append(cond)
    
    joiner = " and " if is_not_cond else " or "
    return joiner.join(conditions)

    
    
def translator_to_lower(base_word: str, target_langs: list[str]) -> str:
    """
    Build case-insensitive XPath conditions using translations of base_word.
    Returns only the OR conditions string, not the full XPath.
    """
    conditions = []
    for lang in target_langs:
        try:
            translated = GoogleTranslator(source='en', target=lang).translate(base_word)
            translated_lower = translated.lower()
            conditions.append(f"""contains(translate(@text,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"{translated_lower}")""")
        except Exception as e: print(f"Translation failed for {lang}: {e}")
    return " or ".join(conditions)


def append_text_translation(translations: list[str], AttrType="@text") -> str:
    """
    Build case-sensitive XPath OR conditions from a list of translated words.
    Each word is compared using contains() directly, without translate().
    Returns only the OR conditions string, not the full XPath.
    """
    conditions = []
    for word in translations:
        conditions.append(f'contains({AttrType},"{word}")')
    return " or ".join(conditions)

    
def collect_translations(translator_dict: dict):
    """
    Given a dictionary where values are lists of words/phrases,
    return a single list containing all items.
    """
    result = []
    for values in translator_dict.values(): result.extend(values)
    return result



NAV_HOME_TEXT_TRANSLATOR = {
    "ENGLISH": ["Home"],
    "GERMAN":  ["Startseite", "Zuhause"],
    "SVENSKA": ["Hem", "Hemma"],
    "NORSK": ["Startside", "Hjem"]
}

NAV_LIBRARY_TEXT_TRANSLATOR = {
    "ENGLISH": ["Library"],
    "GERMAN":  ["Mediathek", "Bibliothek"],
    "SVENSKA": ["Bibliotek"],
    "NORSK": ["Bibliotek"]
}

NAV_UPGRADE_TEXT_TRANSLATOR = {
    "ENGLISH": ["Upgrade"],
    "GERMAN": ["Upgrade", "Aktualisieren"],
    "SWISS_GERMAN": ["Upgrade"],
    "FRENCH": ["Mettre à niveau"],
    "TURKISH": ["Yükselt"],
    "NORWEGIAN": ["Oppgrader"],
    "SPANISH": ["Actualizar", "Mejorar"],
    "ITALIAN": ["Aggiorna"],
    "DUTCH": ["Upgraden", "Bijwerken"],
    "SWEDISH": ["Uppgradera"],
    "DANISH": ["Opgrader"],
    "FINNISH": ["Päivitä"],
    "PORTUGUESE": ["Atualizar"],
    "POLISH": ["Ulepsz"],
    "CZECH": ["Upgradovat", "Vylepšit"],
    "SLOVAK": ["Inovovať", "Vylepšiť"],
    "SERBIAN": ["Nadogradi"],
    "SLOVENIAN": ["Nadgradi"],
    "CROATIAN": ["Nadogradi"],
    "HUNGARIAN": ["Frissítés", "Frissítsen"],
    "FAROESE": ["Uppstiga"],
    "ALBANIAN": ["Përmirëso"],
    "ICELANDIC": ["Uppfæra"]
}

NAV_SAMPLES_TEXT_TRANSLATOR = {
    "ENGLISH": ["Samples"],
    "GERMAN":  ["Muster", "Beispiele"],
    "SVENSKA": ["Samples", "Exempel"],
    "NORSK": ["Samples", "Eksempler"]
}

NAV_SEARCH_TEXT_TRANSLATOR = {
    "ENGLISH": ["Search"],
    "GERMAN":  ["Suchen", "Suche"],
    "SVENSKA": ["Sök"],
    "NORSK": ["Søk"]
}

NAV_EXPLORE_TEXT_TRANSLATOR = {
    "ENGLISH": ["Explore"],
    "GERMAN":  ["Entdecken", "Erkunden"],
    "SVENSKA": ["Utforska"],
    "NORSK": ["Utforsk"]
}

ARTISTS_TEXT_TRANSLATOR = {
    "ENGLISH": ["Artists"],
    "GERMAN":  ["Künstler"],
    "SVENSKA": ["Artist", "Artister"],
    "NORSK": ["Artist", "Artister"]
}

PROFILES_TEXT_TRANSLATOR = {
    "ENGLISH": ["Profiles"],
    "GERMAN":  ["Profil", "Profile"],
    "SVENSKA": ["Profil", "Profiler"],
    "NORSK": ["Profil", "Profiler"]
}

SONGS_TEXT_TRANSLATOR = {
    "ENGLISH": ["Songs"],
    "GERMAN":  ["Titel", "Lied", "Lieder"],
    "SVENSKA": ["Låt", "Låtar"],
    "NORSK": ["Sang", "Sanger"]
}

COMMUNITY_TEXT_TRANSLATOR = {
    "ENGLISH": ["Community playlists"],
    "GERMAN":  ["Community-Playlist", "Community-Playlists"],
    "SVENSKA": ["Spellista av communityn", "Spellistor av communityn"],
    "NORSK": ["Spilleliste fra fellesskapet", "Spillelister fra fellesskapet"]
}

FEATURED_PL_TEXT_TRANSLATOR = {
    "ENGLISH": ["Featured playlists"],
    "GERMAN":  ["Empfohlene Playlist", "Empfohlene Playlists"],
    "SVENSKA": ["Utvald spellista", "Utvalda spellistor"],
    "NORSK": ["Utvalgt spilleliste", "Utvalgte spillelister"]
}

BACK_TEXT_TRANSLATOR = {
    "ENGLISH": ["Back"],
    "GERMAN":  ["Zurück"],
    "SVENSKA": ["Bakåt", "Tillbaka"],
    "NORSK": ["Tilbake"]
}

SEARCH_BACK_TEXT_TRANSLATOR = {
    "ENGLISH": ["Search back"],
    "GERMAN":  ["Zurücksuchen"],
    "SVENSKA": ["Sök bakåt"],
    "NORSK": ["Søk bakover"]
}

SHUFFLE_TEXT_TRANSLATOR = {
    "ENGLISH": ["Shuffle"],
    "GERMAN":  ["Zufall", "Mischen"],
    "SVENSKA": ["Shuffla", "Blanda"],
    "NORSK": ["Shuffel", "Bland"]
}

SHUFFLE_PLAY_TEXT_TRANSLATOR = {
    "ENGLISH": ["Shuffle play"],
    "GERMAN":  ["Zufallsmix abspielen"],
    "SVENSKA": ["Shuffla uppspelning", "Blanda uppspelning"],
    "NORSK": ["Spill i tilfeldig rekkefølge"]
}
PLAY_TEXT_TRANSLATOR = {
    "ENGLISH": ["Play"],
    "GERMAN":  ["Abspielen"],
    "SVENSKA": ["Spela"],
    "NORSK":   ["Spill"]
}
SAVE_TEXT_TRANSLATOR = {
    "ENGLISH": ["Save"],
    "GERMAN":  ["Speichern"],
    "SVENSKA": ["Spara"],
    "NORSK":   ["Lagre"]
}


START_MIX_TEXT_TRANSLATOR = {
    "ENGLISH": ["Start mix"],
    "GERMAN":  ["Radio", "Mischen beginnen"],
    "SVENSKA": ["Starta radio", "Starta mix"],
    "NORSK": ["Start radioen", "Start miks"]
}

PLAY_ALL_TEXT_TRANSLATOR = {
    "ENGLISH": ["Play all"],
    "GERMAN": ["Alle abspielen"],
    "SVENSKA": ["Spela alla"],
    "NORSK": ["Spill alle"],
    "SPANISH": ["Reproducir todo"],
    "FRENCH": ["Lire tout"],
    "ITALIAN": ["Riproduci tutto"],
    "PORTUGUESE": ["Reproduzir tudo"],
    "DUTCH": ["Alles afspela"],
    "TURKISH": ["Tümünü oynat"],
    "ARABIC": ["تشغيل الكل"],
    "CHINESE_SIMPLIFIED": ["播放全部"],
    "JAPANESE": ["すべて再生"],
    "KOREAN": ["모두 재생"]
}


CLOSE_MUSIC_TEXT_TRANSLATOR = {
    "ENGLISH": ["Close"],
    "GERMAN":  ["Schließen"],
    "SVENSKA": ["Stäng"],
    "NORSK": ["Lukk"]
}

LIBRARY_PLAYLIST_TEXT_TRANSLATOR = {
    "ENGLISH": ["Playlists"],
    "GERMAN":  ["Wiedergabeliste", "Wiedergabelisten"],
    "SVENSKA": ["Spellista", "Spellistor"],
    "NORSK": ["Spilleliste", "Spillelister"]
}

LIBRARY_SONGS_TEXT_TRANSLATOR = {
    "ENGLISH": ["Songs"],
    "GERMAN":  ["Titel", "Lied", "Lieder"],
    "SVENSKA": ["Låt", "Låtar"],
    "NORSK": ["Sang", "Sanger"]
}

LIBRARY_ARTISTS_TEXT_TRANSLATOR = {
    "ENGLISH": ["Artists"],
    "GERMAN":  ["Künstler"],
    "SVENSKA": ["Artist", "Artister"],
    "NORSK": ["Artist", "Artister"]
}

LIBRARY_ALBUMS_TEXT_TRANSLATOR = {
    "ENGLISH": ["Albums"],
    "GERMAN":  ["Album", "Alben"],
    "SVENSKA": ["Album", "Album (plural same)"],
    "NORSK": ["Album", "Album (plural same)"]
}

LIBRARY_PLAY_TEXT_TRANSLATOR = {
    "ENGLISH": ["Play"],
    "GERMAN":  ["Spielen", "Abspielen"],
    "SVENSKA": ["Spela"],
    "NORSK": ["Spill", "Spill av"]
}

ACTION_MENU_TEXT_TRANSLATOR = {
    "ENGLISH": ["Action menu"],
    "GERMAN":  ["Aktionsmenü"],
    "SVENSKA": ["Åtgärdsmeny"],
    "NORSK": ["Handlingsmeny"]
}

ACTIION_MENU_SHUFFLE_TEXT_TRANSLATOR = {
    "ENGLISH": ["Shuffle play"],
    "GERMAN":  ["Zufallsmix abspielen"],
    "SVENSKA": ["Shuffla uppspelning", "Blanda uppspelning"],
    "NORSK": ["Spill i tilfeldig rekkefølge"]
}

COOKIE_ACCEPT_BUTTON_TEXTS = [
    # --- English ---
    "Accept", "Agree", "Accept All", "Accept All Cookies", "Accept Cookies", "Accept & Continue",
    "Accept and Continue", "Accept Selected", "Accept Necessary", "Accept Recommended", "Accept Choices", "Accept Settings", 
    "I Accept", "I Agree", "Agree All", "Agree & Continue", "Agree and Continue",
    "Allow", "Allow All", "Allow All Cookies", "Allow Cookies", "Allow Selected", "Allow Necessary",
    "Enable Cookies", "Enable All", "Enable All Cookies",
    "Yes", "Yes, I Agree", "Yes, Accept", "Yes, Accept All",
    "OK", "ok for me", "OK, Got It", "Got It", "Understood",
    "Confirm", "Confirm Selection", "Confirm Preferences",
    "Continue", "Continue with Cookies", "Continue to Site", "Continue and Accept",
    "Save & Accept", "Save and Accept", "Save and Continue", "Save Preferences", "Save Settings", "Save Choices",
    "Submit", "Submit Preferences", "Submit Consent",
    "Give Consent", "I Consent", "Provide Consent", "Grant Consent", "Consent", "Allow & Close",
    "Accept & Close", "Close and Accept", "Close and Continue", "Accept ✓", "✓ Accept", "✓ Agree",
    "accept", "accept all", "accept all cookies", "agree", "allow", "save preferences", "continue",
    "Accept!", "Agree!", "Allow!", "Yes!", "OK!", "Continue →", "Accept →", "Agree →",

    # "Confirm My Choices",

    # # --- French ---
    # "Accepter", "Accepter tout", "Accepter les cookies", "Accepter & Continuer",
    # "Accepter et continuer", "Accepter la sélection", "Accepter les nécessaires", "Accepter les recommandés",
    # "Oui", "Oui, j'accepte", "OK", "Compris", "Confirmer", "Confirmer mes choix", "Enregistrer et accepter",
    # "Continuer", "Continuer avec les cookies", "Continuer vers le site", "Autoriser", "Autoriser tout",
    # "Autoriser la sélection", "Autoriser les nécessaires", "Accepter ✓", "✓ Accepter",

    # # --- German ---
    # "Akzeptieren", "Mehr akzeptieren", "Alle akzeptieren", "Cookies akzeptieren", "Akzeptieren & Fortfahren",
    # "Akzeptieren und fortfahren", "Auswahl akzeptieren", "Notwendige akzeptieren", "Empfohlene akzeptieren",
    # "Ja", "Ja, ich stimme zu", "OK", "Verstanden", "Bestätigen", "Meine Auswahl bestätigen",
    # "Speichern & Akzeptieren", "Speichern und akzeptieren", "Weiter", "Weiter mit Cookies", "Erlauben", "Alle erlauben",
    # "Auswahl erlauben", "Notwendige erlauben", "Akzeptieren ✓", "✓ Akzeptieren", "✓ Zustimmen",

    # # --- Spanish ---
    # "Aceptar", "Aceptar todo", "Aceptar cookies", "Aceptar y continuar", "Aceptar selección", "Aceptar necesarios",
    # "Aceptar recomendados", "Sí", "Sí, acepto", "OK", "Entendido", "Confirmar", "Confirmar selección", "Guardar y aceptar",
    # "Continuar", "Continuar con cookies", "Continuar al sitio", "Permitir", "Permitir todo", "Permitir selección",
    # "Permitir necesarios", "Aceptar ✓", "✓ Aceptar",

    # # --- Italian ---
    # "Accetta", "Accetta tutto", "Accetta i cookie", "Accetta & Continua", "Accetta e continua", "Accetta selezionati",
    # "Accetta necessari", "Accetta consigliati", "Sì", "Sì, accetto", "OK", "Capito", "Conferma", "Conferma selezione",
    # "Salva e accetta", "Continua", "Continua con i cookie", "Consenti", "Consenti tutto", "Consenti selezionati",
    # "Consenti necessari", "Accetta ✓", "✓ Accetta",

    # # --- Dutch ---
    # "Accepteren", "Alles accepteren", "Cookies accepteren", "Accepteren & Doorgaan", "Accepteren en doorgaan",
    # "Accepteer geselecteerde", "Accepteer noodzakelijke", "Ja", "Ja, ik ga akkoord", "OK", "Begrepen", "Bevestigen",
    # "Bevestig mijn keuzes", "Opslaan & Accepteren", "Opslaan en accepteren", "Doorgaan", "Doorgaan met cookies",
    # "Toestaan", "Alles toestaan", "Selectie toestaan", "Noodzakelijk toestaan", "Accepteer ✓", "✓ Accepteren",

    # # --- Swedish ---
    # "Acceptera", "Acceptera alla", "Acceptera cookies", "Acceptera & Fortsätt", "Acceptera och fortsätt",
    # "Acceptera urval", "Acceptera nödvändiga", "Ja", "Ja, jag accepterar", "OK", "Förstått", "Bekräfta",
    # "Bekräfta mitt val", "Spara & Acceptera", "Fortsätt", "Fortsätt med cookies", "Tillåt", "Tillåt alla",
    # "Tillåt valda", "Tillåt nödvändiga", "Acceptera ✓", "✓ Acceptera",

    # # --- Norwegian ---
    # "Aksepter", "Aksepter alle", "Aksepter cookies", "Aksepter & Fortsett", "Aksepter og fortsett",
    # "Aksepter valgte", "Aksepter nødvendige", "Ja", "Ja, jeg godtar", "OK", "Forstått", "Bekreft",
    # "Bekreft mine valg", "Lagre & Aksepter", "Fortsett", "Fortsett med cookies", "Tillat", "Tillat alle",
    # "Tillat valgte", "Tillat nødvendige", "Aksepter ✓", "✓ Aksepter",

    # # --- Finnish ---
    # "Hyväksy", "Hyväksy kaikki", "Hyväksy evästeet", "Hyväksy & Jatka", "Hyväksy ja jatka",
    # "Hyväksy valitut", "Hyväksy tarvittavat", "Kyllä", "Kyllä, hyväksyn", "OK", "Ymmärretty", "Vahvista",
    # "Vahvista valintani", "Tallenna & Hyväksy", "Jatka", "Jatka evästeiden kanssa", "Salli", "Salli kaikki",
    # "Salli valitut", "Salli tarvittavat", "Hyväksy ✓", "✓ Hyväksy",

    # # --- Portuguese ---
    # "Aceitar", "Aceitar tudo", "Aceitar cookies", "Aceitar & Continuar", "Aceitar e continuar",
    # "Aceitar selecionados", "Aceitar necessários", "Sim", "Sim, eu aceito", "OK", "Entendido", "Confirmar",
    # "Confirmar seleção", "Salvar & Aceitar", "Continuar", "Continuar com cookies", "Permitir", "Permitir tudo",
    # "Permitir selecionados", "Permitir necessários", "Aceitar ✓", "✓ Aceitar",

    # # --- Polish ---
    # "Akceptuj", "Akceptuj wszystkie", "Akceptuj ciasteczka", "Akceptuj & Kontynuuj", "Akceptuj i kontynuuj",
    # "Akceptuj wybrane", "Akceptuj niezbędne", "Tak", "Tak, akceptuję", "OK", "Zrozumiano", "Potwierdź",
    # "Potwierdź wybór", "Zapisz & Akceptuj", "Kontynuuj", "Kontynuuj z ciasteczkami", "Zezwól", "Zezwól wszystkim",
    # "Zezwól wybranym", "Zezwól niezbędnym", "Akceptuj ✓", "✓ Akceptuj",

    # # --- Czech ---
    # "Přijmout", "Přijmout vše", "Přijmout cookies", "Přijmout & Pokračovat", "Přijmout a pokračovat",
    # "Přijmout vybrané", "Přijmout nezbytné", "Ano", "Ano, souhlasím", "OK", "Rozumím", "Potvrdit",
    # "Potvrdit výběr", "Uložit & Přijmout", "Pokračovat", "Pokračovat s cookies", "Povolit", "Povolit vše",
    # "Povolit vybrané", "Povolit nezbytné", "Přijmout ✓", "✓ Přijmout",

    # # --- Hungarian ---
    # "Elfogad", "Összes elfogadása", "Cookie-k elfogadása", "Elfogad & Folytatás", "Elfogad és folytat",
    # "Kiválasztottak elfogadása", "Szükségesek elfogadása", "Igen", "Igen, elfogadom", "OK", "Értettem", "Megerősít",
    # "Választás megerősítése", "Mentés & Elfogadás", "Folytatás", "Folytatás a cookie-kkal", "Engedélyez", "Mind engedélyezése",
    # "Kiválasztottak engedélyezése", "Szükségesek engedélyezése", "Elfogad ✓", "✓ Elfogad",

    # # --- Albanian ---
    # "Prano", "Prano të gjitha", "Prano cookies", "Prano & Vazhdoni", "Prano dhe vazhdo",
    # "Prano të zgjedhura", "Prano të nevojshme", "Po", "Po, pranoj", "OK", "Kuptuar", "Konfirmo",
    # "Konfirmo zgjedhjen", "Ruaj & Prano", "Vazhdo", "Vazhdo me cookies", "Lejo", "Lejo të gjitha",
    # "Lejo të zgjedhura", "Lejo të nevojshme", "Prano ✓", "✓ Prano"
]

SHOW_MORE_RESULTS_TRANSLATOR = {
    "ENGLISH": ["More search results"],
    "GERMAN": ["Mehr Suchergebnisse"],
    "SWISS_GERMAN": ["Mehr Suchresultate"],
    "FRENCH": ["Plus de résultats"],
    "TURKISH": ["Daha fazla sonuç"],
    "NORWEGIAN": ["Flere resultater"],
    "SPANISH": ["Más resultados"],
    "ITALIAN": ["Altri risultati"],
    "DUTCH": ["Meer resultaten"],
    "SWEDISH": ["Fler resultat"],
    "DANISH": ["Flere resultater"],
    "FINNISH": ["Lisää tuloksia"],
    "PORTUGUESE": ["Mais resultados"],
    "POLISH": ["Więcej wyników"],
    "CZECH": ["Více výsledků"],
    "SLOVAK": ["Viac výsledkov"],
    "SERBIAN": ["Više rezultata"],
    "SLOVENIAN": ["Več rezultatov"],
    "CROATIAN": ["Više rezultata"],
    "HUNGARIAN": ["További találatok"],
    "FAROESE": ["Fleiri úrslit"],
    "ALBANIAN": ["Më shumë rezultate"],
    "ICELANDIC": ["Flere søkresultater"]
}

MUSIC_PREMIUM_TEXT_TRANSLATOR = {
    "ENGLISH": ["Music Premium"],
    "GERMAN": ["Music Premium"],
    "SWISS_GERMAN": ["Music Premium"],
    "FRENCH": ["Music Premium"],
    "TURKISH": ["Music Premium"],
    "NORWEGIAN": ["Music Premium"],
    "SPANISH": ["Music Premium"],
    "ITALIAN": ["Music Premium"],
    "DUTCH": ["Music Premium"],
    "SWEDISH": ["Music Premium"],
    "DANISH": ["Music Premium"],
    "FINNISH": ["Music Premium"]
}

POPUP_CLOSE_TRANSLATOR = {
    "ENGLISH": ["Close"],
    "GERMAN": ["Schließen"],
    "SWISS_GERMAN": ["Schliessen"],
    "FRENCH": ["Fermer"],
    "TURKISH": ["Kapat"],
    "NORWEGIAN": ["Lukk"],
    "SPANISH": ["Cerrar"],
    "ITALIAN": ["Chiudi"],
    "DUTCH": ["Sluiten"],
    "SWEDISH": ["Stäng"],
    "DANISH": ["Luk"],
    "FINNISH": ["Sulje"],
    "PORTUGUESE": ["Fechar"],
    "POLISH": ["Zamknij"],
    "CZECH": ["Zavřít"],
    "SLOVAK": ["Zavrieť"],
    "SERBIAN": ["Zatvori"],
    "SLOVENIAN": ["Zapri"],
    "CROATIAN": ["Zatvori"],
    "HUNGARIAN": ["Bezár"],
    "FAROESE": ["Lat aftur"],
    "ALBANIAN": ["Mbyll"],
    "ICELANDIC": ["Loka"]
}

CONFIRM_BUTTON_TEXT_TRANSLATOR = {
    "ENGLISH": ["Confirm"],
    "GERMAN": ["Bestätigen"],
    "SWISS_GERMAN": ["Bestätigen"],
    "FRENCH": ["Confirmer"],
    "TURKISH": ["Onayla"],
    "NORWEGIAN": ["Bekreft"],
    "SPANISH": ["Confirmar"],
    "ITALIAN": ["Conferma"],
    "DUTCH": ["Bevestigen"],
    "SWEDISH": ["Bekräfta"],
    "DANISH": ["Bekræft"],
    "FINNISH": ["Vahvista"],
    "PORTUGUESE": ["Confirmar"],
    "POLISH": ["Potwierdź"],
    "CZECH": ["Potvrdit"],
    "SLOVAK": ["Potvrdiť"],
    "SERBIAN": ["Potvrdi"],
    "SLOVENIAN": ["Potrdi"],
    "CROATIAN": ["Potvrdi"],
    "HUNGARIAN": ["Megerősítés"],
    "FAROESE": ["Vátta"],
    "ALBANIAN": ["Konfirmo"],
    "ICELANDIC": ["Staðfesta"]
}
NOTNOW_BUTTON_TEXT_TRANSLATOR = {
    "ENGLISH": ["Not now"],
    "GERMAN": ["Nicht jetzt"],
    "SWISS_GERMAN": ["Nöd jetzt"],
    "FRENCH": ["Pas maintenant"],
    "TURKISH": ["Şimdi değil"],
    "NORWEGIAN": ["Ikke nå"],
    "SPANISH": ["Ahora no"],
    "ITALIAN": ["Non ora"],
    "DUTCH": ["Niet nu"],
    "SWEDISH": ["Inte nu"],
    "DANISH": ["Ikke nu"],
    "FINNISH": ["Ei nyt"],
    "PORTUGUESE": ["Agora não"],
    "POLISH": ["Nie teraz"],
    "CZECH": ["Teď ne"],
    "SLOVAK": ["Nie teraz"],
    "SERBIAN": ["Ne sada"],
    "SLOVENIAN": ["Ne zdaj"],
    "CROATIAN": ["Ne sada"],
    "HUNGARIAN": ["Most nem"],
    "FAROESE": ["Ikki nú"],
    "ALBANIAN": ["Jo tani"],
    "ICELANDIC": ["Ekki núna"]
}

VIDEO_MAY_BE_INAPPROPRIATE_TRANSLATOR = {
    "ENGLISH": ["video may be inappropriate"],
    "GERMAN": ["video möglicherweise ungeeignet"],
    "SWISS_GERMAN": ["video möglicherweise ungeeignet"],
    "FRENCH": ["vidéo peut être inappropriée"],
    "TURKISH": ["video uygun olmayabilir"],
    "NORWEGIAN": ["video kan være upassende"],
    "SPANISH": ["video puede ser inapropiado"],
    "ITALIAN": ["video potrebbe essere inappropriato"],
    "DUTCH": ["video mogelijk ongepast"],
    "SWEDISH": ["videon kan vara olämplig"],
    "DANISH": ["video kan være upassende"],
    "FINNISH": ["video voi olla sopimaton"],
    "PORTUGUESE": ["vídeo pode ser inapropriado"],
    "POLISH": ["film może być nieodpowiedni"],
    "CZECH": ["video může být nevhodné"],
    "SLOVAK": ["video môže byť nevhodné"],
    "SERBIAN": ["video može biti neprikladan"],
    "SLOVENIAN": ["video je lahko neprimeren"],
    "CROATIAN": ["video može biti neprikladan"],
    "HUNGARIAN": ["videó nem megfelelő"],
    "FAROESE": ["video kann vera óhóskandi"],
    "ALBANIAN": ["video mund të jetë i papërshtatshëm"],
    "ICELANDIC": ["myndband gæti verið óviðeigandi"]
}
LIKE_SONG_POPUP_TEXT_TRANSLATOR = {
    "ENGLISH": ["liked songs will be saved"],
    "GERMAN": ["gelikte songs werden gespeichert"],
    "SWISS_GERMAN": ["gelikte songs werden gespeichert"],
    "FRENCH": ["chansons aimées seront enregistrées"],
    "TURKISH": ["beğenilen şarkılar kaydedilecek"],
    "NORWEGIAN": ["likte sanger vil bli lagret"],
    "SPANISH": ["canciones me gustan se guardarán"],
    "ITALIAN": ["brani piaciuti verranno salvati"],
    "DUTCH": ["gelikete nummers worden opgeslagen"],
    "SWEDISH": ["gillade låtar kommer att sparas"],
    "DANISH": ["likede sange vil blive gemt"],
    "FINNISH": ["tykätyt kappaleet tallennetaan"],
    "PORTUGUESE": ["músicas curtidas serão salvas"],
    "POLISH": ["polubione utwory zostaną zapisane"],
    "CZECH": ["oblíbené skladby budou uloženy"],
    "SLOVAK": ["obľúbené skladby budú uložené"],
    "SERBIAN": ["lajkovane pesme će biti sačuvane"],
    "SLOVENIAN": ["všečkane pesmi bodo shranjene"],
    "CROATIAN": ["lajkane pjesme će biti spremljene"],
    "HUNGARIAN": ["kedvelt dalok mentésre kerülnek"],
    "FAROESE": ["likt sangir verða goymdir"],
    "ALBANIAN": ["këngët e pëlqyera do të ruhen"],
    "ICELANDIC": ["líkuð lög verða vistuð"]
}

SKIPS_AD_TEXT_TRANSLATOR = {
    "Du kan hoppa over",
    "You can skip"
}

CLOSE_THE_AD_PANEL_TRANSLATIONS = [
    "close the ad panel",
    "schließen sie das anzeigefeld",
    "schliessen sie das anzeigefeld",
    "fermez le panneau publicitaire",
    "reklam panelini kapatın",
    "lukk annonsepanelet",
    "cierra el panel de anuncios",
    "chiudi il pannello degli annunci",
    "sluit het advertentiepaneel",
    "stäng annonspanelen",
    "luk annoncepanelet",
    "sulje mainospaneeli",
    "feche o painel de anúncios",
    "zamknij panel reklamowy",
    "zavřete panel reklam",
    "zatvorte panel reklám",
    "zatvorite panel oglasa",
    "zaprite oglasno ploščo",
    "zatvorite panel oglasa",
    "zárja be a hirdetési panelt",
    "lat aftur lýsingarpanelið",
    "mbyll panelin e reklamave",
    "lokaðu auglýsingaspjaldinu"
]

OK_TRANSLATIONS = [
    "OK",          # English
    "Tamam",       # Turkish
    "U redu",      # Serbian
    "V redu",      # Slovenian
    "U redu",      # Croatian
    "OK",          # Hungarian
    "Í lagi",      # Faroese
    "Në rregull",  # Albanian
    "Í lagi"       # Icelandic
]

NO_THANKS_TRANSLATIONS = [
    "no thanks",
    "nein danke",
    "nei danke",
    "non merci",
    "hayır teşekkürler",
    "nei takk",
    "no gracias",
    "no grazie",
    "nee bedankt",
    "nej tack",
    "nej tak",
    "ei kiitos",
    "não obrigado",
    "nie dziękuję",
    "ne děkuji",
    "nie ďakujem",
    "ne hvala",
    "ne hvala",
    "ne hvala",
    "nem köszönöm",
    "nei takk",
    "jo faleminderit",
    "nei takk"
]

VERIFY_NOW_TRANSLATIONS = [
    "verify now",
    "jetzt bestätigen",
    "jetzt bestätigen",
    "vérifier maintenant",
    "şimdi doğrula",
    "bekreft nå",
    "verificar ahora",
    "verifica ora",
    "nu verifiëren",
    "verifiera nu",
    "bekræft nu",
    "vahvista nyt",
    "verificar agora",
    "zweryfikuj teraz",
    "ověřit nyní",
    "overiť teraz",
    "potvrdi sada",
    "preveri zdaj",
    "potvrdi sada",
    "ellenőrizze most",
    "vátta nú",
    "verifiko tani",
    "staðfesta núna"
]




NAV_HOME_TEXT_TRANSLATOR = {
    "ENGLISH": ["Home"],
    "GERMAN":  ["Startseite", "Zuhause"],
    "SVENSKA": ["Hem", "Hemma"],
    "NORSK": ["Startside", "Hjem"]
}

NAV_LIBRARY_TEXT_TRANSLATOR = {
    "ENGLISH": ["Library"],
    "GERMAN":  ["Mediathek", "Bibliothek"],
    "SVENSKA": ["Bibliotek"],
    "NORSK": ["Bibliotek"]
}

NAV_SEARCH_TEXT_TRANSLATOR = {
    "ENGLISH": ["Search"],
    "GERMAN":  ["Suchen", "Suche"],
    "SVENSKA": ["Sök"],
    "NORSK": ["Søk"]
}

YOUTUBE_NAV_SHORTS_TEXT_TRANSLATOR = [
    "Shorts",
    "Bermudas"
]

YOUTUBE_LIKE_THIS_VIDEO_TRANSLATIONS = [
    "Like this video",          # English
    "Mag dieses Video",         # German
    "J’aime cette vidéo",       # French
    "Me gusta este vídeo",      # Spanish
    "Mi piace questo video",    # Italian
    "Vind ik leuk",             # Dutch
    "Gostei deste vídeo",       # Portuguese
    "Podoba mi się ten film",   # Polish
    "Îmi place acest videoclip",# Romanian
    "Gillar den här videon",    # Swedish
    "Liker denne videoen"       # Norwegian
]

YOUTUBE_DISLIKE_TRANSLATIONS = [
    "Dislike this video",        # English
    "Mag ich dieses Video nicht",# German
    "Je n’aime pas cette vidéo", # French
    "No me gusta este vídeo",    # Spanish
    "Non mi piace questo video", # Italian
    "Vind ik deze video niet leuk", # Dutch
    "Não gostei deste vídeo",    # Portuguese
    "Nie podoba mi się ten film",# Polish
    "Nu îmi place acest videoclip", # Romanian
    "Gillar inte den här videon",# Swedish
    "Liker ikke denne videoen"   # Norwegian
]
