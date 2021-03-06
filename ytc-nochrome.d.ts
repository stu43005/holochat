// Generated by https://quicktype.io

export interface Ytcfg {
	DEVICE: string;
	DISABLE_YT_IMG_DELAY_LOADING: boolean;
	EVENT_ID: string;
	EXPERIMENT_FLAGS: ExperimentFlags;
	GAPI_HINT_PARAMS: string;
	GAPI_HOST: string;
	GAPI_LOCALE: string;
	GL: string;
	GOOGLE_FEEDBACK_PRODUCT_ID: string;
	GOOGLE_FEEDBACK_PRODUCT_DATA: GoogleFeedbackProductData;
	HL: string;
	HTML_DIR: string;
	HTML_LANG: string;
	INNERTUBE_API_KEY: string;
	INNERTUBE_API_VERSION: string;
	INNERTUBE_CLIENT_NAME: string;
	INNERTUBE_CLIENT_VERSION: string;
	INNERTUBE_CONTEXT: InnertubeContext;
	INNERTUBE_CONTEXT_CLIENT_NAME: number;
	INNERTUBE_CONTEXT_CLIENT_VERSION: string;
	INNERTUBE_CONTEXT_GL: string;
	INNERTUBE_CONTEXT_HL: string;
	LATEST_ECATCHER_SERVICE_TRACKING_PARAMS: LatestEcatcherServiceTrackingParams;
	LOGGED_IN: boolean;
	PAGE_BUILD_LABEL: string;
	PAGE_CL: number;
	SERVER_NAME: string;
	SESSION_INDEX: string;
	VISITOR_DATA: string;
	XSRF_FIELD_NAME: string;
	XSRF_TOKEN: string;
	YPC_MB_URL: string;
	YTR_FAMILY_CREATION_URL: string;
	SERVER_VERSION: string;
	SERIALIZED_CLIENT_CONFIG_DATA: string;
	LIVE_CHAT_ALLOW_DARK_MODE: boolean;
	POST_TO_PARENT_DOMAIN: string;
	LIVE_CHAT_BASE_TANGO_CONFIG: LiveChatBaseTangoConfig;
	LIVE_CHAT_SEND_MESSAGE_ACTION: string;
}

interface ExperimentFlags {
	kevlar_cancel_scheduled_comment_jobs_on_navigate: boolean;
	kevlar_next_cold_on_auth_change_detected: boolean;
	kevlar_gel_error_routing: boolean;
	kevlar_no_early_init_unpause: boolean;
	kevlar_watch_color_update: boolean;
	enable_streamline_repost_flow: boolean;
	config_age_report_killswitch: boolean;
	nwl_send_fast_on_unload: boolean;
	kevlar_miniplayer_no_update_on_deactivate: boolean;
	kevlar_op_infra: boolean;
	kevlar_cache_on_ttl_browse: boolean;
	html5_pacf_enable_dai: boolean;
	enable_masthead_quartile_ping_fix: boolean;
	kevlar_guide_store: boolean;
	kevlar_center_search_results: boolean;
	desktop_keyboard_capture_keydown_killswitch: boolean;
	kevlar_fetch_networkless_support: boolean;
	web_lifecycles: boolean;
	polymer2_element_pool_properties: boolean;
	pageid_as_header_web: boolean;
	enable_microformat_data: boolean;
	kevlar_enable_reorderable_playlists: boolean;
	kevlar_use_endpoint_for_channel_creation_form: boolean;
	serve_crosswalk_compliant_pdp: boolean;
	enable_mentions_in_reposts: boolean;
	web_forward_command_on_pbj: boolean;
	kevlar_background_color_update: boolean;
	enable_servlet_errors_streamz: boolean;
	kevlar_local_innertube_response: boolean;
	kevlar_ctrl_tap_fix: boolean;
	rich_grid_mini_mode: boolean;
	kevlar_no_url_params: boolean;
	desktop_add_to_playlist_renderer_dialog_popup: boolean;
	player_bootstrap_method: boolean;
	external_fullscreen: boolean;
	kevlar_watch_skeleton: boolean;
	enable_service_ajax_csn: boolean;
	kevlar_collect_hover_touch_support: boolean;
	memberships_page_continuation_migrate: boolean;
	check_user_lact_at_prompt_shown_time_on_web: boolean;
	kevlar_macro_markers_keyboard_shortcut: boolean;
	web_network_combined_catch: boolean;
	polymer_warm_thumbnail_preload: boolean;
	kevlar_cache_on_ttl: boolean;
	kevlar_transcript_engagement_panel: boolean;
	use_better_post_dismissals: boolean;
	web_player_touch_mode_improvements: boolean;
	kevlar_disable_background_prefetch: boolean;
	service_worker_subscribe_with_vapid_key: boolean;
	decorate_autoplay_renderer: boolean;
	kevlar_client_save_subs_preferences: boolean;
	kevlar_update_youtube_sans: boolean;
	kevlar_web_response_context_yt_config_deprecation: boolean;
	kevlar_deprecated_ticker: boolean;
	enable_purchase_activity_in_paid_memberships: boolean;
	kevlar_player_autoplay_count_from_rvs: boolean;
	popup_for_sign_out_report_playlist: boolean;
	kevlar_keyboard_button_focus: boolean;
	enable_web_ketchup_hero_animation: boolean;
	web_refresh_info_panel: boolean;
	kevlar_player_watch_endpoint_navigation: boolean;
	kevlar_tuner_run_default_comments_delay: boolean;
	show_progress_bar_on_live_chat: boolean;
	web_client_counter_random_seed: boolean;
	web_log_app_install_experiments: boolean;
	kevlar_player_playlist_use_local_index: boolean;
	kevlar_prefetch: boolean;
	trending_explore_shelf_enable_collapse: boolean;
	kevlar_calculate_grid_collapsible: boolean;
	kevlar_queue_use_update_api: boolean;
	kevlar_shell_for_downloads_page: boolean;
	kevlar_include_query_in_search_endpoint: boolean;
	kevlar_nitrate_driven_tooltips: boolean;
	player_doubletap_to_seek: boolean;
	kevlar_clear_non_displayable_url_params: boolean;
	kevlar_op_page_service_search: boolean;
	log_web_endpoint_to_layer: boolean;
	kevlar_clean_up: boolean;
	web_log_connection: boolean;
	retry_web_logging_batches: boolean;
	searchbox_reporting: boolean;
	web_always_load_chat_support: boolean;
	disable_signout_supex_users: boolean;
	kevlar_playback_associated_queue: boolean;
	enable_business_email_reveal_servlet_migration: boolean;
	kevlar_scrollbar_rework: boolean;
	kevlar_transcript_panel_refreshed_styles: boolean;
	kevlar_inlined_html_templates_polymer_flags: boolean;
	kevlar_allow_queue_reorder: boolean;
	mdx_load_cast_api_bootstrap_script: boolean;
	flush_gel: boolean;
	endpoint_handler_logging_cleanup_killswitch: boolean;
	kevlar_passive_event_listeners: boolean;
	player_allow_autonav_after_playlist: boolean;
	desktop_sparkles_light_cta_button: boolean;
	enable_polymer_resin_migration: boolean;
	spf_kevlar_assume_chunked: boolean;
	disable_legacy_desktop_remote_queue: boolean;
	web_move_autoplay_video_under_chip: boolean;
	cache_utc_offset_minutes_in_pref_cookie: boolean;
	kevlar_tuner_should_defer_detach: boolean;
	kevlar_playlist_responsive: boolean;
	live_chat_over_playlist: boolean;
	enable_poll_choice_border_on_web: boolean;
	enable_polymer_resin: boolean;
	kevlar_droppable_prefetchable_requests: boolean;
	kevlar_disable_channels_flow_param: boolean;
	networkless_gel: boolean;
	kevlar_set_internal_player_size: boolean;
	enable_programmed_playlist_redesign: boolean;
	browse_next_continuations_migration_playlist: boolean;
	web_deprecate_service_ajax_map_dependency: boolean;
	kevlar_command_handler: boolean;
	kevlar_appshell_service_worker: boolean;
	kevlar_copy_playlist: boolean;
	kevlar_guide_ajax_migration: boolean;
	record_app_crashed_web: boolean;
	kevlar_miniplayer_play_pause_on_scrim: boolean;
	desktop_search_prominent_thumbs: boolean;
	kevlar_channel_trailer_multi_attach: boolean;
	kevlar_watch_drag_handles: boolean;
	kevlar_no_autoscroll_on_playlist_hover: boolean;
	kevlar_miniplayer_set_watch_next: boolean;
	enable_memberships_and_purchases: boolean;
	kevlar_snap_state_refresh: boolean;
	kevlar_frontend_video_list_actions: boolean;
	kevlar_mix_handle_first_endpoint_different: boolean;
	kevlar_autonav_popup_filtering: boolean;
	defer_menus: boolean;
	enable_offer_suppression: boolean;
	kevlar_frontend_queue_recover: boolean;
	desktop_player_touch_gestures: boolean;
	web_dont_cancel_pending_navigation_same_url: boolean;
	enable_client_streamz_web: boolean;
	kevlar_client_side_screens: boolean;
	desktop_persistent_menu: boolean;
	kevlar_watch_next_chips_continuations_migration: boolean;
	enable_nwl_cleaning_logic: boolean;
	suppress_gen_204: boolean;
	enable_call_to_action_clarification_renderer_bottom_section_conditions: boolean;
	suppress_error_204_logging: boolean;
	kevlar_rendererstamper_event_listener: boolean;
	web_screen_associated_all_layers: boolean;
	kevlar_playlist_drag_handles: boolean;
	disable_thumbnail_preloading: boolean;
	kevlar_picker_ajax_migration: boolean;
	enable_get_account_switcher_endpoint_on_webfe: boolean;
	allow_https_streaming_for_all: boolean;
	enable_ve_tracker_key: boolean;
	player_endscreen_ellipsis_fix: boolean;
	web_gel_timeout_cap: boolean;
	warm_load_nav_start_web: boolean;
	include_autoplay_count_in_playlists: boolean;
	enable_player_microformat_data: boolean;
	enable_gel_log_commands: boolean;
	polymer_bad_build_labels: boolean;
	get_midroll_info_use_client_rpc: boolean;
	web_api_url: boolean;
	live_chat_use_punctual: boolean;
	offline_error_handling: boolean;
	polymer_task_manager_proxied_promise: boolean;
	web_autonav_allow_off_by_default: boolean;
	kevlar_collect_battery_network_status: boolean;
	kevlar_thumbnail_overlay_new_elementpool_schedule: boolean;
	kevlar_thumbnail_equalizer_killswitch: boolean;
	enable_mixed_direction_formatted_strings: boolean;
	kevlar_should_maintain_stable_list: boolean;
	desktop_swipeable_guide: boolean;
	kevlar_watch_navigation_clear_autoplay_count_session_data: boolean;
	enable_new_product_page_ux: boolean;
	kevlar_miniplayer_expand_top: boolean;
	kevlar_fallback_to_page_data_root_ve: boolean;
	enable_yto_window: boolean;
	polymer_verifiy_app_state: boolean;
	kevlar_use_one_platform_for_queue_refresh: boolean;
	kevlar_queue_use_dedicated_list_type: boolean;
	live_chat_use_fetch_command: boolean;
	enable_servlet_streamz: boolean;
	kevlar_op_migration_batch_3: boolean;
	use_source_element_if_present_for_actions: boolean;
	enable_web_poster_hover_animation: boolean;
	your_data_entrypoint: boolean;
	kevlar_miniplayer: boolean;
	kevlar_autonav_miniplayer_fix: boolean;
	gfeedback_for_signed_out_users_enabled: boolean;
	kevlar_miniplayer_set_element_early: boolean;
	kevlar_eager_shell_boot_via_one_platform: boolean;
	kevlar_help_use_locale: boolean;
	kevlar_home_skeleton: boolean;
	kevlar_newness_dot_high_contrast: boolean;
	cold_missing_history: boolean;
	enable_ytc_self_serve_refunds: boolean;
	kevlar_persistent_response_store: boolean;
	desktop_adjust_touch_target: boolean;
	web_show_description_tag_movies: boolean;
	web_yt_config_context: boolean;
	web_visitorid_in_datasync: boolean;
	kevlar_use_page_data_will_update: boolean;
	disable_simple_mixed_direction_formatted_strings: boolean;
	kevlar_allow_playlist_reorder: boolean;
	web_player_watch_next_response: boolean;
	kevlar_op_migration: boolean;
	web_appshell_refresh_trigger: boolean;
	reload_without_polymer_innertube: boolean;
	kevlar_prepare_player_on_miniplayer_activation: boolean;
	kevlar_system_icons: boolean;
	kevlar_one_pick_add_video_to_playlist: boolean;
	deprecate_pair_servlet_enabled: boolean;
	kevlar_enable_slis: boolean;
	kevlar_topbar_logo_fallback_home: boolean;
	kevlar_player_response_swf_config_wrapper_killswitch: boolean;
	live_chat_attestation_signal: boolean;
	kevlar_allow_multistep_video_init: boolean;
	kevlar_home_skeleton_hide_later: boolean;
	global_spacebar_pause: boolean;
	kevlar_hide_pp_url_param: boolean;
	kevlar_watch_increased_width_threshold: boolean;
	web_player_move_autonav_toggle: boolean;
	desktop_animate_miniplayer: boolean;
	enable_topsoil_wta_for_halftime: boolean;
	external_fullscreen_with_edu: boolean;
	skip_endpoint_param_comparison: boolean;
	player_enable_playback_playlist_change: boolean;
	kevlar_save_queue: boolean;
	kevlar_touch_gesture_ves: boolean;
	element_pool_populator_auto_abort: boolean;
	disable_features_for_supex: boolean;
	web_hide_autonav_headline: boolean;
	enable_topic_channel_tabs: boolean;
	live_chat_increased_min_height: boolean;
	kevlar_abandon_on_stop: boolean;
	kevlar_fix_miniplayer_logging: boolean;
	desktop_action_companion_wta_support: boolean;
	autoescape_tempdata_url: boolean;
	kevlar_playlist_autonav_loop_fix: boolean;
	kevlar_warm_settings_killswitch: boolean;
	persistent_miniplayer: boolean;
	enable_signals: boolean;
	enable_post_scheduling: boolean;
	kevlar_hide_time_continue_url_param: boolean;
	fill_web_player_context_config: boolean;
	kevlar_watch_js_panel_height: boolean;
	web_show_regex_error_textarea: boolean;
	live_chat_unicode_emoji_skintone_update: boolean;
	web_log_connection_in_gel: boolean;
	polymer2_polyfill_manual_flush: boolean;
	kevlar_disable_html_imports: boolean;
	should_clear_video_data_on_player_cued_unstarted: boolean;
	enable_premium_voluntary_pause: boolean;
	enable_ypc_spinners: boolean;
	is_part_of_any_user_engagement_experiment: boolean;
	desktop_touch_gestures_usage_log: boolean;
	kevlar_resolve_playlist_endpoint_as_watch_endpoint: boolean;
	kevlar_thumbnail_fluid: boolean;
	gal_client_migration_mweb: boolean;
	kevlar_channels_player_handle_missing_swfconfig: boolean;
	kevlar_masthead_store: boolean;
	kevlar_enable_editable_playlists: boolean;
	kevlar_dropdown_fix: boolean;
	is_kevlar_wexit_main_launch: boolean;
	web_enable_ad_signals_in_it_context: boolean;
	kevlar_standard_scrollbar_color: boolean;
	kevlar_use_ytd_player: boolean;
	kevlar_lazy_list_resume_for_autofill: boolean;
	kevlar_use_response_ttl_to_invalidate_cache: boolean;
	kevlar_watch_next_continuations_migration: boolean;
	disable_youthere_lact_threshold_check: boolean;
	web_appshell_purge_trigger: boolean;
	disable_child_node_auto_formatted_strings: boolean;
	mdx_enable_privacy_disclosure_ui: boolean;
	pdg_disable_web_super_vod_explicit_click_logging: boolean;
	enable_super_vod_price_selector: boolean;
	networkless_logging: boolean;
	kevlar_autofocus_menu_on_keyboard_nav: boolean;
	polymer_video_renderer_defer_menu: boolean;
	serve_pdp_at_canonical_url: boolean;
	enable_button_behavior_reuse: boolean;
	kevlar_exit_fullscreen_leaving_watch: boolean;
	custom_csi_timeline_use_gel: boolean;
	web_move_passive_signin: boolean;
	is_mweb_wexit_main_launch: boolean;
	defer_overlays: boolean;
	web_player_enable_ipp: boolean;
	kevlar_op_migration_batch_2: boolean;
	kevlar_js_fixes: boolean;
	enable_docked_chat_messages: boolean;
	desktop_themeable_vulcan: boolean;
	mweb_csi_watch_fix: boolean;
	web_response_processor_support: boolean;
	botguard_periodic_refresh: boolean;
	kevlar_voice_search: boolean;
	defer_rendering_outside_visible_area: boolean;
	web_hide_autonav_keyline: boolean;
	kevlar_use_page_command_url: boolean;
	web_enable_history_cache_map: boolean;
	kevlar_mealbar_above_player: boolean;
	kevlar_op_page_service_browse: boolean;
	kevlar_logged_out_topbar_menu_migration: boolean;
	kevlar_miniplayer_queue_user_activation: boolean;
	csi_on_gel: boolean;
	kevlar_three_dot_ink: boolean;
	kevlar_fix_playlist_continuation: boolean;
	kevlar_player_disable_rvs_update: boolean;
	kevlar_guide_refresh: boolean;
	service_worker_push_enabled: boolean;
	service_worker_push_home_page_prompt: boolean;
	enable_watch_next_pause_autoplay_lact: boolean;
	cancel_pending_navs: boolean;
	no_sub_count_on_sub_button: boolean;
	use_watch_fragments2: boolean;
	service_worker_enabled: boolean;
	desktop_pyv_on_watch_missing_params: boolean;
	service_worker_push_watch_page_prompt: boolean;
	desktop_client_release: boolean;
	is_browser_support_for_webcam_streaming: boolean;
	desktop_notification_set_title_bar: boolean;
	log_vis_on_tab_change: boolean;
	desktop_notification_high_priority_ignore_push: boolean;
	nwl_cleaning_rate: number;
	ytidb_transaction_ended_event_rate_limit: number;
	kevlar_tuner_thumbnail_factor: number;
	web_system_health_fraction: number;
	addto_ajax_log_warning_fraction: number;
	nwl_latency_sampling_rate: number;
	kevlar_tuner_clamp_device_pixel_ratio: number;
	browse_ajax_log_warning_fraction: number;
	polymer_report_missing_web_navigation_endpoint_rate: number;
	log_window_onerror_fraction: number;
	log_js_exceptions_fraction: number;
	polymer_report_client_url_requested_rate: number;
	autoplay_pause_by_lact_sampling_fraction: number;
	desktop_polymer_video_masthead_session_tempdata_ttl: number;
	desktop_search_suggestion_tap_target: number;
	minimum_duration_to_consider_mouseover_as_hover: number;
	kevlar_mini_guide_width_threshold: number;
	log_web_meta_interval_ms: number;
	prefetch_comments_ms_after_video: number;
	web_logging_max_batch: number;
	preview_play_duration: number;
	kevlar_time_caching_start_threshold: number;
	leader_election_check_interval: number;
	min_mouse_still_duration: number;
	kevlar_tooltip_impression_cap: number;
	botguard_async_snapshot_timeout_ms: number;
	visibility_time_between_jobs_ms: number;
	max_duration_to_consider_mouseover_as_hover: number;
	kevlar_persistent_guide_width_threshold: number;
	ytidb_transaction_try_count: number;
	kevlar_tuner_scheduler_soft_state_timer_ms: number;
	external_fullscreen_button_click_threshold: number;
	yoodle_start_time_utc: number;
	user_engagement_experiments_rate_limit_ms: number;
	network_polling_interval: number;
	kevlar_tuner_default_comments_delay: number;
	high_priority_flyout_frequency: number;
	viewport_load_collection_wait_time: number;
	live_chat_incremental_emoji_rendering_target_framerate: number;
	client_streamz_web_flush_count: number;
	leader_election_lease_ttl: number;
	autoplay_time: number;
	check_navigator_accuracy_timeout_ms: number;
	kevlar_time_caching_end_threshold: number;
	kevlar_tuner_visibility_time_between_jobs_ms: number;
	external_fullscreen_button_shown_threshold: number;
	client_streamz_web_flush_interval_seconds: number;
	html5_experiment_id_label: number;
	trending_explore_shelf_max_rows: number;
	autoplay_time_for_music_content_after_autoplayed_video: number;
	web_foreground_heartbeat_interval_ms: number;
	show_ghost_card_continuations: number;
	leader_election_renewal_interval: number;
	user_mention_suggestions_edu_impression_cap: number;
	autoplay_time_for_music_content: number;
	yoodle_end_time_utc: number;
	yoodle_jitter_seconds_web: number;
	pbj_navigate_limit: number;
	web_gel_debounce_ms: number;
	web_emulated_idle_callback_delay: number;
	service_worker_push_prompt_delay_microseconds: number;
	service_worker_push_logged_out_prompt_watches: number;
	autoplay_pause_by_lact_sec: number;
	service_worker_push_prompt_cap: number;
	watch_next_pause_autoplay_lact_sec: number;
	polymer_task_manager_status: string;
	yoodle_alt_text: string;
	yoodle_end_time: string;
	yoodle_start_time: string;
	live_chat_unicode_emoji_json_url: string;
	yoodle_date_override_debug: string;
	web_client_version_override: string;
	debug_forced_internalcountrycode: string;
	consent_url_override: string;
	desktop_web_client_version_override: string;
	cb_v2_uxe: string;
	desktop_search_prominent_thumbs_style: string;
	thumbnail_overlay_deferral_priority: string;
	yoodle_webp_base_url: string;
	kevlar_next_up_next_edu_emoji: string;
	yoodle_alt_text_locale: string;
	yoodle_base_url: string;
	service_worker_push_force_notification_prompt_tag: string;
	service_worker_scope: string;
	web_op_signal_type_banlist: any[];
	web_op_endpoint_banlist: any[];
	kevlar_command_handler_command_banlist: any[];
	kevlar_op_browse_sampled_prefix_ids: any[];
	kevlar_page_service_url_prefix_carveouts: any[];
	ten_video_reordering: number[];
	twelve_video_reordering: number[];
	kevlar_mousedown_prefetchable_components: any[];
	guide_legal_footer_enabled_countries: string[];
	web_op_continuation_type_banlist: any[];
	guide_business_info_countries: string[];
}

interface GoogleFeedbackProductData {
	polymer: string;
	polymer2: string;
	accept_language: string;
}

interface InnertubeContext {
	client: Client;
	user: User;
	request: Request;
	clickTracking: ClickTracking;
}

interface Client {
	hl: string;
	gl: string;
	remoteHost: string;
	deviceMake: string;
	deviceModel: string;
	visitorData: string;
	userAgent: string;
	clientName: string;
	clientVersion: string;
	osName: string;
	osVersion: string;
	originalUrl: string;
	platform: string;
	clientFormFactor: string;
	browserName: string;
	browserVersion: string;
}

interface ClickTracking {
	clickTrackingParams: string;
}

interface Request {
	useSsl: boolean;
}

interface User {
	lockedSafetyMode: boolean;
}

interface LatestEcatcherServiceTrackingParams {
	"client.name": string;
}

interface LiveChatBaseTangoConfig {
	apiKey: string;
	channelUri: string;
	clientName: string;
	requiresAuthToken: boolean;
	senderUri: string;
	useNewTango: boolean;
}

export interface GetLiveChatData {
	videoId: string;
	apiKey: string;
	visitorData: string;
	clientName: string;
	clientVersion: string;
	body: GetLiveChatBody;
	timeoutMs: number;
	retry: number;
}

export interface GetLiveChatBody {
	context:       Context;
	continuation:  string;
	webClientInfo: WebClientInfo;
}

interface Context {
	client:            Client2;
	user:              User;
	request:           Request2;
	clickTracking:     ClickTracking;
	clientScreenNonce?: string;
	adSignalsInfo:     AdSignalsInfo;
}

interface AdSignalsInfo {
	params: Param[];
}

interface Param {
	key:   string;
	value: string;
}

interface Client2 {
	hl:                 string;
	gl:                 string;
	remoteHost:         string;
	deviceMake:         string;
	deviceModel:        string;
	visitorData:        string;
	userAgent:          string;
	clientName:         string;
	clientVersion:      string;
	osName:             string;
	osVersion:          string;
	originalUrl:        string;
	platform:           string;
	clientFormFactor:   string;
	browserName:        string;
	browserVersion:     string;
	screenWidthPoints:  number;
	screenHeightPoints: number;
	screenPixelDensity: number;
	screenDensityFloat: number;
	utcOffsetMinutes:   number;
	userInterfaceTheme: string;
	connectionType:     string;
	mainAppWebInfo:     MainAppWebInfo;
	timeZone:           string;
}

interface MainAppWebInfo {
	graftUrl:       string;
	webDisplayMode: string;
}

interface Request2 {
	useSsl:                  boolean;
	internalExperimentFlags: any[];
	consistencyTokenJars:    any[];
}

interface WebClientInfo {
	isDocumentHidden: boolean;
}
