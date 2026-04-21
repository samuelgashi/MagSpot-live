
# ------------------------------
# ------- VERSION 2.0
# ------------------------------


from app.utils.translator import *


###################################
## NAVIGATION & HOME SCREEN BUTTONS

# HOME
HOME_BUTTON_XPATH1 = f"""(//*[contains(@resource-id, "music:id/text1") and ({to_lower_conditions(collect_translations(NAV_HOME_TEXT_TRANSLATOR))})])/parent::*"""
HOME_BUTTON_XPATH2 = f"""(//*[contains(@resource-id,'music:id/pivot_bar')]//*[{to_lower_conditions(collect_translations(NAV_HOME_TEXT_TRANSLATOR))}])/parent::*"""

# SEARCH
NAV_SEARCH_BUTTON_XPATH1 = f"""//*[contains(@resource-id,'music:id/text1') and {to_lower_conditions(collect_translations(NAV_SEARCH_TEXT_TRANSLATOR))}]/parent::*"""
NAV_SEARCH_BUTTON_XPATH2 = f"""//*[contains(@resource-id, "music:id/pivot_bar")]//*[{to_lower_conditions(collect_translations(NAV_SEARCH_TEXT_TRANSLATOR))}]/parent::*"""

# SAMPLES
SAMPLES_BUTTON_XPATH1 = f"""//*[contains(@resource-id, "music:id/text1") and ({to_lower_conditions(collect_translations(NAV_SAMPLES_TEXT_TRANSLATOR))})]/parent::*"""
SAMPLES_BUTTON_XPATH2 = f"""//*[contains(@resource-id, "music:id/pivot_bar")]//*[{to_lower_conditions(collect_translations(NAV_SAMPLES_TEXT_TRANSLATOR))}]/parent::*"""

# EXPLORE
EXPLORE_BUTTON_XPATH1 = f"""//*[contains(@resource-id, "music:id/text1") and ({to_lower_conditions(collect_translations(NAV_EXPLORE_TEXT_TRANSLATOR))})]/parent::*"""
EXPLORE_BUTTON_XPATH2 = f"""//*[contains(@resource-id, "music:id/pivot_bar")]//*[{to_lower_conditions(collect_translations(NAV_EXPLORE_TEXT_TRANSLATOR))})]/parent::*"""

# LIBRARY
LIBRARY_BUTTON_XPATH1 = f"""//*[contains(@resource-id, "music:id/text1") and ({to_lower_conditions(collect_translations(NAV_LIBRARY_TEXT_TRANSLATOR))})]/parent::*"""
LIBRARY_BUTTON_XPATH2 = f"""//*[contains(@resource-id, "music:id/pivot_bar")]//*[{to_lower_conditions(collect_translations(NAV_LIBRARY_TEXT_TRANSLATOR))}]/parent::*"""

# SEARCH
NAV_UPGRADE_BUTTON_XPATH1 = f"""//*[contains(@resource-id,'music:id/text1') and {to_lower_conditions(collect_translations(NAV_UPGRADE_TEXT_TRANSLATOR))}]/parent::*"""
NAV_UPGRADE_BUTTON_XPATH2 = f"""//*[contains(@resource-id, "music:id/pivot_bar")]//*[{to_lower_conditions(collect_translations(NAV_UPGRADE_TEXT_TRANSLATOR))}]/parent::*"""


# SEARCH BUTTON
SEARCH_BUTTON_XPATH1 = "//*[contains(@resource-id,'com.google.android.apps.youtube.music:id/action_search_button')]"
SEARCH_BUTTON_XPATH2 = f"""//*[{to_lower_conditions(collect_translations(NAV_SEARCH_TEXT_TRANSLATOR), AttrType="@content-desc")}]"""

# SEARCH INPUT
SEARCH_INPUT_XPATH1 = '//*[contains(@resource-id,"com.google.android.apps.youtube.music:id/search_edit_text")]'
SEARCH_INPUT_XPATH2 = '//*[contains(@resource-id,"com.google.android.apps.youtube.music:id/search_edit_text")]'

# SEARCH_DIRECTOR
YT_MUSIC_SEARCH_DIRECTORY_XPATH = '//*[contains(@content-desc="YT Music")]'
LIBRARY_SEARCH_DIRECTORY_XPATH = f"""//*[{to_lower_conditions(collect_translations(NAV_LIBRARY_TEXT_TRANSLATOR), AttrType="@content-desc")}]"""


############################
## INPUT SEARCH FILTERS

# FILTER BOX
SEARCH_FILTERS_BOX_XPATH1  = "//*[contains(@resource-id, 'music:id/chip_cloud')]"
SEARCH_FILTERS_BOX_XPATH2 = '//android.support.v7.widget.RecyclerView[@resource-id="com.google.android.apps.youtube.music:id/chip_cloud"]'
SEARCH_FILTER_CUSTOM_XPATH = lambda filter_name: f"""//*[contains(@resource-id,'music:id/chip_cloud_chip_text') and @text='{filter_name}']"""

# ARTISTS
SEARCH_FILTERS_ARTISTS_XPATH1 = f"""//*[contains(@resource-id,'music:id/chip_cloud_chip_text') and ({to_lower_conditions(collect_translations(ARTISTS_TEXT_TRANSLATOR))})]"""
SEARCH_FILTERS_ARTISTS_XPATH2 = f"""//android.support.v7.widget.RecyclerView[contains(@resource-id, 'music:id/chip_cloud')]//*[@text and ({to_lower_conditions(collect_translations(ARTISTS_TEXT_TRANSLATOR))})]"""

# PROFILES
SEARCH_FILTERS_PROFILES_XPATH1 = f"""//*[contains(@resource-id,'music:id/chip_cloud_chip_text') and ({to_lower_conditions(collect_translations(PROFILES_TEXT_TRANSLATOR))})]"""
SEARCH_FILTERS_PROFILES_XPATH2 = f"""//android.support.v7.widget.RecyclerView[contains(@resource-id, 'music:id/chip_cloud')]//*[@text and ({to_lower_conditions(collect_translations(PROFILES_TEXT_TRANSLATOR))})]"""

# ALBUMS
SEARCH_FILTERS_ALBUMS_XPATH1 = f"""//*[contains(@resource-id,'music:id/chip_cloud_chip_text') and ({to_lower_conditions(collect_translations(LIBRARY_ALBUMS_TEXT_TRANSLATOR))})]"""
SEARCH_FILTERS_ALBUMS_XPATH2 = f"""//android.support.v7.widget.RecyclerView[contains(@resource-id, 'music:id/chip_cloud')]//*[@text and ({to_lower_conditions(collect_translations(LIBRARY_ALBUMS_TEXT_TRANSLATOR))})]"""

# SONGS
SEARCH_FILTERS_SONGS_XPATH1 = f"""//*[contains(@resource-id,'music:id/chip_cloud_chip_text') and ({to_lower_conditions(collect_translations(SONGS_TEXT_TRANSLATOR))})]"""
SEARCH_FILTERS_SONGS_XPATH2 = f"""//android.support.v7.widget.RecyclerView[contains(@resource-id, 'music:id/chip_cloud')]//*[@text and ({to_lower_conditions(collect_translations(SONGS_TEXT_TRANSLATOR))})]"""

# COMMUNITY PLAYLIST
SEARCH_FILTERS_COMMUNITY_PL_XPATH1 = f"""//*[contains(@resource-id,'music:id/chip_cloud_chip_text') and ({to_lower_conditions(collect_translations(COMMUNITY_TEXT_TRANSLATOR))})]"""
SEARCH_FILTERS_COMMUNITY_PL_XPATH2 = f"""//android.support.v7.widget.RecyclerView[contains(@resource-id, 'music:id/chip_cloud')]//*[@text and ({to_lower_conditions(collect_translations(COMMUNITY_TEXT_TRANSLATOR))})]"""

# FEATUREDT PLAYLIST
SEARCH_FILTERS_FEATURED_PL_XPATH1 = f"""//*[contains(@resource-id,'music:id/chip_cloud_chip_text') and ({to_lower_conditions(collect_translations(FEATURED_PL_TEXT_TRANSLATOR))})]"""
SEARCH_FILTERS_FEATURED_PL_XPATH2 = f"""//android.support.v7.widget.RecyclerView[contains(@resource-id, 'music:id/chip_cloud')]//*[@text and ({to_lower_conditions(collect_translations(FEATURED_PL_TEXT_TRANSLATOR))})]"""

# SEARCH_GO_BACK
SEARCH_GO_BACK_BUTTON_XPATH = f"""//android.widget.ImageView[{to_lower_conditions(collect_translations(SEARCH_BACK_TEXT_TRANSLATOR), AttrType="@content-desc")}]"""

# SEARH RESULTS
SEARCH_RESULTS_BOX_XPATH = '//*[@resource-id="com.google.android.apps.youtube.music:id/results_list"]'
SELECT_TARGET_FROM_RESULTS = lambda matching_text: f"""//*[contains(@resource-id, 'music:id/results_list')]
  //*[contains(
      translate(@text,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),
      '{matching_text.lower()}'
  )]
"""


############################
## LIBRARY SCREEN

SEARCH_RESULT_FEATURED_BOX_XPATH1 = f"""//android.view.ViewGroup[{to_lower_conditions(collect_translations(SHUFFLE_PLAY_TEXT_TRANSLATOR), AttrType="@content-desc")}]/parent::*"""
SEARCH_RESULT_FEATURED_BOX_XPATH2 = f"""//android.view.ViewGroup[{to_lower_conditions(collect_translations(SHUFFLE_PLAY_TEXT_TRANSLATOR), AttrType="@content-desc")}]/parent::*"""
SEARCH_RESULT_FEATURED_BOX_XPATH3 = f"""//android.view.ViewGroup[{to_lower_conditions(collect_translations(PLAY_TEXT_TRANSLATOR), AttrType="@content-desc")}]/parent::*"""
SEARCH_RESULT_FEATURED_BOX_XPATH4 = f"""//android.view.ViewGroup[{to_lower_conditions(collect_translations(SAVE_TEXT_TRANSLATOR), AttrType="@content-desc")}]/parent::*"""
SHUFFLE_PLAY_BUTTON_XPATH1 = f"""//android.view.ViewGroup[{to_lower_conditions(collect_translations(SHUFFLE_PLAY_TEXT_TRANSLATOR), AttrType="@content-desc")}]"""
SHUFFLE_PLAY_BUTTON_XPATH2 = f"""//*[@resource-id="com.google.android.apps.youtube.music:id/results_list"]/*[{to_lower_conditions(collect_translations(SHUFFLE_TEXT_TRANSLATOR), AttrType="@content-desc")}]"""
START_MIX_BUTTON_XPATH = f"""//android.view.ViewGroup[{to_lower_conditions(collect_translations(START_MIX_TEXT_TRANSLATOR), AttrType="@content-desc")}]"""
CLOSE_MUSIC_PROPERTIES_XPATH = f"""//android.view.ViewGroup[{to_lower_conditions(collect_translations(CLOSE_MUSIC_TEXT_TRANSLATOR), AttrType="@content-desc")}]"""
SEARCH_RESULTS_THUMBNAILS_XPATH = f"""//*[contains(@resource-id, 'id/results_list')]/android.view.ViewGroup//android.view.ViewGroup[1]/android.widget.ImageView"""
# TARGET_PLAYALL_BUTTON_XPATH = f"""(//android.view.ViewGroup[{to_lower_conditions(collect_translations(PLAY_ALL_TEXT_TRANSLATOR), AttrType="@content-desc")}])[2]"""
TARGET_PLAYALL_BUTTON_XPATH = f"""//android.view.ViewGroup[{to_lower_conditions(collect_translations(PLAY_ALL_TEXT_TRANSLATOR), AttrType="@content-desc")}]"""

MUSIC_DOWN_BUTTON_XPATH = "//*[@resource-id='com.google.android.apps.youtube.music:id/toolbar_back_navigation']"
POPUP_RUNNING_MUSIC='//*[@resource-id="com.google.android.apps.youtube.music:id/mini_player"]'

# LIBRARY FILTERS
LIBRARY_FILTER_BOX_XPATH = "//*[contains(@resource-id, 'music:id/chip_cloud')]"
LIBRARY_FILTER_PLAYLISTS_XPATH = f"""//*[contains(@resource-id,'music:id/chip_cloud_chip_text') and ({to_lower_conditions(collect_translations(LIBRARY_PLAYLIST_TEXT_TRANSLATOR))})]"""
LIBRARY_FILTER_SONGS_XPATH = f"""//*[contains(@resource-id,'music:id/chip_cloud_chip_text') and ({to_lower_conditions(collect_translations(LIBRARY_SONGS_TEXT_TRANSLATOR))})]"""
LIBRARY_FILTER_ARTISTS_XPATH = f"""//*[contains(@resource-id,'music:id/chip_cloud_chip_text') and ({to_lower_conditions(collect_translations(LIBRARY_ARTISTS_TEXT_TRANSLATOR))})]"""
LIBRARY_FILTER_ALBUMS_XPATH = f"""//*[contains(@resource-id,'music:id/chip_cloud_chip_text') and ({to_lower_conditions(collect_translations(LIBRARY_ALBUMS_TEXT_TRANSLATOR))})]"""
LIBRARY_RESULTS_LIST = f"""//*[contains(@resource-id,"music:id/section_list_content")]//*[contains(@resource-id,"music:id/title")]"""
LIBRARY_SEARCH_PLAYLIST = lambda playlist_name: f"""(//*[
    @resource-id="com.google.android.apps.youtube.music:id/title"
    and (
        ({to_lower_conditions([playlist_name], AttrType="@text")})
        or 
        ({to_lower_conditions([playlist_name], AttrType="@content-desc")})
    )
])//parent::*/parent::*"""

TARGET_SEARCH_WITH_PROFILE = lambda target_name: f"""(//*[
    @resource-id="com.google.android.apps.youtube.music:id/title"
    and (
        ({to_lower_conditions([target_name], AttrType="@text")})
        or 
        ({to_lower_conditions([target_name], AttrType="@content-desc")})
    )
])//parent::*/parent::*//android.widget.ImageView[contains(@resource-id, 'thumbnail')]"""

# LIBRARY_SEARCH_PLAYLIST = lambda playlist_name: f"""//*[
#     @resource-id="com.google.android.apps.youtube.music:id/title"
#     and (
#         contains(translate(@text,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), "{playlist_name.lower()}")
#         or
#         contains(translate(@content-desc,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), "{playlist_name.lower()}")
#     )
# ]"""
LIBRARY_PLAYLIST_PLAY_BUTTON_XPATH = f"""//*[contains(@resource-id, 'elements_container')]//*[{to_lower_conditions(collect_translations(LIBRARY_PLAY_TEXT_TRANSLATOR), AttrType="@content-desc")}]"""
ACTION_MENU_BUTTON_XPAHT1 = f"""//*[@resource-id='com.google.android.apps.youtube.music:id/elements_container']//*[@content-desc and ({to_lower_conditions(collect_translations(ACTION_MENU_TEXT_TRANSLATOR), AttrType="@content-desc")})]"""
ACTION_MENU_BUTTON_XPAHT2 = f"""//*[@resource-id='com.google.android.apps.youtube.music:id/elements_container']//*[({append_text_translation(collect_translations(ACTION_MENU_TEXT_TRANSLATOR), AttrType="@content-desc")})]"""

FIRST_ACTION_MENU_BUTTON_XPAHT1 = f"""(//*[@content-desc and ({to_lower_conditions(collect_translations(ACTION_MENU_TEXT_TRANSLATOR), AttrType="@content-desc")})])[1]"""
FIRST_ACTION_MENU_BUTTON_XPAHT2 = f"""(//*[({append_text_translation(collect_translations(ACTION_MENU_TEXT_TRANSLATOR), AttrType="@content-desc")})])[1]"""

ACTIION_MENU_SHUFFLE_PLAY_BUTTON = f"""//*[@resource-id='com.google.android.apps.youtube.music:id/text' and ({to_lower_conditions(collect_translations(ACTIION_MENU_SHUFFLE_TEXT_TRANSLATOR))})]//parent::*"""

SEARCH_ACTION_MENU_XPATH  = f"""(//*[contains(@resource-id, 'results_list')]//*[@content-desc and ({to_lower_conditions(collect_translations(ACTION_MENU_TEXT_TRANSLATOR), AttrType="@content-desc")})])[1]"""
SEARCH_BOTTOM_SHUFFLE_PLAY_BUTTON_XPATH = f"""//*[contains(@resource-id, 'bottom_sheet')]//*[({to_lower_conditions(collect_translations(SHUFFLE_PLAY_TEXT_TRANSLATOR), AttrType="@content-desc")})]"""

############################
## MUSIC PLAYER SCREEN

# ARTIST NAME:
PLAYER_ARTIST_NAME_XPATH1 = f"""//*[contains(@resource-id, "id/artist")]"""
PLAYER_ARTIST_NAME_XPATH2 = """//*[contains(@resource-id, 'id/title_and_artist_container')]//*[contains(@resource-id, 'id/artist')]"""

# SHUFFLE:
PLAYER_SHUFFLE_XPATH1 = """//*[contains(@resource-id,'playback_queue_shuffle_button_view')]"""
PLAYER_SHUFFLE_INDICATOR_XPATH1 = """//*[contains(@resource-id,'playback_queue_shuffle_button_view') ]//*[contains(@resource-id,'playback_control_indicator')]"""

# PREVIOUS:
PLAYER_PREVIOUS_XPATH1 = """//*[contains(@resource-id,"controls_container")]//*[contains(@resource-id, "player_control_previous_button")]"""
PLAYER_PREVIOUS_XPATH1 = """//*[contains(@resource-id,"controls_container")]//*[contains(@content-desc, "Previous track")]"""

# PLAY BUTTON:
PLAYER_PLAY_XPATH1 = """//*[contains(@resource-id,"controls_container")]//*[contains(@resource-id, "player_control_play_pause_replay_button")]"""
PLAYER_PLAY_XPATH2 = """//*[contains(@resource-id,"controls_container")]//*[contains(@content-desc, "Play video")]"""

# PREVIOUS:
PLAYER_NEXT_XPATH1 = """//*[contains(@resource-id,"controls_container")]//*[contains(@resource-id, "player_control_next_button")]"""
PLAYER_NEXT_XPATH2 = """//*[contains(@resource-id,"controls_container")]//*[contains(@content-desc, "Next track")]"""

# REPEAT:
PLAYER_REPEAT_XPATH1 = """//*[contains(@resource-id,"controls_container")]//*[contains(@resource-id, "playback_queue_loop_button_view")]"""
PLAYER_REPEAT_XPATH2 = """//*[contains(@resource-id,"controls_container")]//*[contains(@content-desc, "Repeat off")]"""


# TIME BAR:
PLAYER_TIME_SLIDER_XPATH1 = """//*[contains(@resource-id, 'music_playback_controls')]//*[contains(@resource-id,"time_bar")]"""
# LIKE VIDEO:
PLAYER_LIKE_MUSIC_XPATH = """(//*[contains(@resource-id, 'video_action_bar')]//*[contains(@class, 'android.support.v7.widget.RecyclerView')]/android.view.ViewGroup[1]//android.widget.ImageView)[1]"""
# DISLIKE VIDEO:
PLAYER_DISLIKE_MUSIC_XPATH = """(//*[contains(@resource-id, 'video_action_bar')]//*[contains(@class, 'android.support.v7.widget.RecyclerView')]/android.view.ViewGroup[1]//android.widget.ImageView)[2]"""
# SAVE MUSIC:
PLAYER_SAVE_MUSIC_XPATH = """//*[contains(@resource-id, 'video_action_bar')]//*[contains(@class, 'android.support.v7.widget.RecyclerView')]/android.view.ViewGroup[2]//android.widget.ImageView"""
# SHARE MUSIC:
PLAYER_SHARE_MUSIC_XPATH = """//*[contains(@resource-id, 'video_action_bar')]//*[contains(@class, 'android.support.v7.widget.RecyclerView')]/android.view.ViewGroup[3]//android.widget.ImageView"""

# MUSIC GO BACK
MUSIC_GO_BACK_BUTTON_XPATH = f"""//*[{to_lower_conditions(collect_translations(BACK_TEXT_TRANSLATOR ), AttrType="@content-desc")}]"""

# MORE RELATED MUSIC RESULTS:
PLAYER_RELATED_MUSICS_XPATH = """//*[contains(@resource-id, 'player_bottom_sheet')]"""

# GOOGLE WARN-UP
GOOGLE_SEARCH_INPUT = f"""//*[contains(@resource-id, 'id/search_box_text')]"""
GOOGLE_RESULTS_BLOGS = f"""//*[@class="UBFage"]"""
GOOGLE_RESULTS_BLOGS = f"""//a[@role='presentation' and @data-ved]"""
GOOGLE_RESULTS_NATIVE = f"""//*[@resource-id="rso"]//*[@content-desc and not(contains(@content-desc, 'About this result'))]"""
GOOGLE_RESULTS_WEBVIEW = f"""//a[@href      and contains(@ping, '/url?')      and not(contains(@href, 'google.com'))      and not(contains(@href, 'search.'))      and not(text())      and not(ancestor::div[@jsslot])]""" # //*[@id="rso"]
COOKIES_ACCEPT_BUTTON = f"""//android.widget.Button[@content-desc="Accept all"]"""
MORE_SEARCH_RESULTS_WEBVIEW = f"""//*[{to_lower_conditions(collect_translations(SHOW_MORE_RESULTS_TRANSLATOR ), AttrType="@aria-label")}]"""
COOKIES_ACCEPT_BUTTON_NATIVE = f"""//*[({to_lower_conditions(COOKIE_ACCEPT_BUTTON_TEXTS, AttrType="@content-desc")})]"""
COOKIES_ACCEPT_BUTTON_NATIVE = f"""//*[({to_lower_conditions(COOKIE_ACCEPT_BUTTON_TEXTS, AttrType="@content-desc")})]"""
COOKIES_ACCEPT_BUTTON_WEBVIEW = f"""//*[({to_lower_conditions(COOKIE_ACCEPT_BUTTON_TEXTS, AttrType="text()")}) and (self::button or self::a or @role='button')]"""

GOOGLE_APP_SEARCH_NATIVE_XPATH1 = "//*[@resource-id='com.google.android.googlequicksearchbox:id/googleapp_srp_search_box_text']"
GOOGLE_APP_SEARCH_NATIVE_XPATH2 = "//*[contains(@resource-id, 'googleapp_facade_search_box')]//android.widget.TextView"

COOKIES_ACCEPT_BUTTON_WEBVIEW = f"""(
    //button | //a | //*[@role='button'] | //input[@type='button' or @type='submit']
)
[
    (
        ({to_lower_conditions(COOKIE_ACCEPT_BUTTON_TEXTS, AttrType=".")})
        or ({to_lower_conditions(COOKIE_ACCEPT_BUTTON_TEXTS, AttrType="@aria-label")})
        or ({to_lower_conditions(COOKIE_ACCEPT_BUTTON_TEXTS, AttrType="@value")})
        or ({to_lower_conditions(COOKIE_ACCEPT_BUTTON_TEXTS, AttrType="@title")})
        or ({to_lower_conditions(COOKIE_ACCEPT_BUTTON_TEXTS, AttrType="@id")})
        or ({to_lower_conditions(COOKIE_ACCEPT_BUTTON_TEXTS, AttrType="@class")})
    )
    and
    string-length(normalize-space(.)) > 0
    and
    string-length(normalize-space(.)) <= 35
    and not(
        contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"reject")
        or contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"decline")
        or contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"deny")
        or contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"manage")
        or contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"settings")
        or contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"preferences")
    )
]"""

CHECK_PREMIUM_POPUP = f"""//*[{to_lower_conditions(collect_translations(MUSIC_PREMIUM_TEXT_TRANSLATOR), AttrType="@content-desc")}]"""
CLOSE_PREMIUM_POPUP = f"""//*[{to_lower_conditions(collect_translations(POPUP_CLOSE_TRANSLATOR), AttrType="@content-desc")}]"""

INAPPROPRIATE_POPUPP_XPATH = f"""//*[{to_lower_conditions(collect_translations(VIDEO_MAY_BE_INAPPROPRIATE_TRANSLATOR), AttrType="@text", do_lower_case=True, do_translate=False)} ]"""
CONFIRM_BUTTON_XPATH = f"""//*[{to_lower_conditions(collect_translations(CONFIRM_BUTTON_TEXT_TRANSLATOR), AttrType="@text")} and ..//*[contains(@resource-id, 'android:id/message')]]"""

LIKE_SONG_POPUP_XPATH = f"""//*[{to_lower_conditions(collect_translations(LIKE_SONG_POPUP_TEXT_TRANSLATOR), AttrType="@text", do_lower_case=True, do_translate=True)} ]"""
OK_BUTTON_TEXT_TRANSLATOR = f"""//*[{to_lower_conditions(OK_TRANSLATIONS, AttrType="@text")} ]"""

VERIFY_NOW_AGA_VERIFICATION_XPATH = f"""//*[{to_lower_conditions(VERIFY_NOW_TRANSLATIONS, AttrType="@text")} ]"""
NOT_NOW_AGA_VERIFICATION_XPATH = f"""//*[{to_lower_conditions(collect_translations(NOTNOW_BUTTON_TEXT_TRANSLATOR), AttrType="@text")} ]"""

SKIP_ADS_XPATH = f"""//*[contains(@resource-id, 'id/skip_ad_button')]"""
SKIP_ADS_TEXT_XPATH = f"""//*[contains(@resource-id, 'id/skip_ad_text')]"""
SKIP_ADS_PROGRESS_XPATH = f"""//*[contains(@resource-id, 'id/ad_progress_text')]"""

CLOSE_AD_PANEL_STATIC = f"""//*[contains(@resource-id, 'id/watch_engagement_panel')]//*[contains(@content-desc, "Stäng annonspanelen")]"""
CLOSE_AD_PANEL = f"""//*[contains(@resource-id, 'id/watch_engagement_panel')]//*[{to_lower_conditions(CLOSE_THE_AD_PANEL_TRANSLATIONS, AttrType="@content-desc")}]"""

NO_THANKS_BUY_PREMIUM_BTN_XPATH = f"""//*[contains(@resource-id, 'id/secondary_action') and ({to_lower_conditions(NO_THANKS_TRANSLATIONS, AttrType="@text")})]"""



# HOME
YOUTUBE_NAV_HOME_BUTTON_XPATH1 = f"""(//*[contains(@resource-id, "id/text") and ({to_lower_conditions(collect_translations(NAV_HOME_TEXT_TRANSLATOR))})])/parent::*"""
YOUTUBE_NAV_HOME_BUTTON_XPATH2 = f"""(//*[contains(@resource-id,'id/pivot_bar')]//*[{to_lower_conditions(collect_translations(NAV_HOME_TEXT_TRANSLATOR))}])/parent::*"""

# SHORTS
YOUTUBE_NAV_SHORTS_XPATH1 = f"""(//*[contains(@resource-id, "id/text") and ({to_lower_conditions(YOUTUBE_NAV_SHORTS_TEXT_TRANSLATOR)})])/parent::*"""
YOUTUBE_NAV_SHORTS_XPATH2 = f"""(//*[contains(@resource-id,'id/pivot_bar')]//*[{to_lower_conditions(YOUTUBE_NAV_SHORTS_TEXT_TRANSLATOR)}])/parent::*"""

# SEARCH
YOUTUBE_NAV_SEARCH_XPATH1 = f"""//*[{to_lower_conditions(collect_translations(NAV_SEARCH_TEXT_TRANSLATOR), AttrType="@content-desc")}]"""

# SEARCH
YOUTUBE_LIKE_BUTTON_XPATH = f"""//*[({to_lower_conditions(YOUTUBE_LIKE_THIS_VIDEO_TRANSLATIONS, AttrType="@content-desc")}) and ({to_lower_conditions(YOUTUBE_DISLIKE_TRANSLATIONS, AttrType="@content-desc", is_not_cond=True)})]"""
YOUTUBE_DISLIKE_BUTTON_XPATH = f"""//*[({to_lower_conditions(YOUTUBE_DISLIKE_TRANSLATIONS, AttrType="@content-desc")})]"""
