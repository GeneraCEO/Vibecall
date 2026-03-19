// lib/services/livekit_config.dart
// ─────────────────────────────────────────────────────────────────────────────
// VibeCall Flutter — LiveKit + WebRTC configuration loader
//
// Usage:
//   final config = await LiveKitConfig.load(userId: user.id);
//   await room.connect(config.serverUrl, config.token,
//     roomOptions: RoomOptions(rtcConfiguration: config.rtcConfig));
//
// Dependencies (pubspec.yaml):
//   livekit_client: ^2.x
//   flutter_webrtc: ^0.9.x
//   dio: ^5.x
// ─────────────────────────────────────────────────────────────────────────────

import 'package:livekit_client/livekit_client.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:dio/dio.dart';

const _apiBase = String.fromEnvironment('API_URL',
    defaultValue: 'http://localhost:4000');

class LiveKitConfig {
  final String token;
  final String serverUrl;
  final RTCConfiguration rtcConfig;
  final String roomName;
  final bool isHost;
  final bool canRecord;

  const LiveKitConfig({
    required this.token,
    required this.serverUrl,
    required this.rtcConfig,
    required this.roomName,
    required this.isHost,
    required this.canRecord,
  });

  // ── Fetch token + RTCConfiguration from your Node.js backend ────────────────
  static Future<LiveKitConfig> load({
    required String roomCode,
    required String authToken,
    bool relayOnly = false,        // set true on restrictive networks (some ME/Corp)
    String? displayName,
  }) async {
    final dio = Dio();
    dio.options.headers['Authorization'] = 'Bearer $authToken';
    dio.options.headers['Content-Type']  = 'application/json';

    final response = await dio.post(
      '$_apiBase/api/livekit/token',
      data: {
        'roomCode':        roomCode,
        'participantName': displayName,
        'relayOnly':       relayOnly,
      },
    );

    final data      = response.data as Map<String, dynamic>;
    final rtcData   = data['rtcConfig'] as Map<String, dynamic>;

    return LiveKitConfig(
      token:      data['token']      as String,
      serverUrl:  data['liveKitHost'] as String,
      roomName:   data['roomName']   as String,
      isHost:     data['isHost']     as bool,
      canRecord:  data['canRecord']  as bool,
      rtcConfig:  _parseRTCConfig(rtcData),
    );
  }

  // ── Parse server response → Flutter RTCConfiguration ────────────────────────
  // This maps the Node.js buildRTCConfiguration() output to Flutter's
  // RTCConfiguration object — equivalent to:
  //
  //   final config = RTCConfiguration(
  //     iceServers: [
  //       {'urls': 'stun:stun.l.google.com:19302'},
  //       {'urls': 'turn:turn-us.vibecall.app:3478', 'username': '...', 'credential': '...'},
  //       // ... 5 more regional TURNs
  //     ],
  //     iceTransportPolicy: 'all',
  //   );
  static RTCConfiguration _parseRTCConfig(Map<String, dynamic> data) {
    final rawServers = data['iceServers'] as List<dynamic>;
    final policy     = data['iceTransportPolicy'] as String? ?? 'all';

    final iceServers = rawServers.map((s) {
      final server = s as Map<String, dynamic>;
      final urls   = server['urls'];

      // urls can be String or List<String>
      final urlsList = urls is List
          ? List<String>.from(urls)
          : [urls as String];

      return {
        'urls':       urlsList,
        if (server.containsKey('username'))   'username':   server['username'],
        if (server.containsKey('credential')) 'credential': server['credential'],
      };
    }).toList();

    return RTCConfiguration(
      iceServers:          iceServers,
      iceTransportPolicy:  policy,       // 'all' | 'relay'
      bundlePolicy:        'max-bundle',
      rtcpMuxPolicy:       'require',
      sdpSemantics:        'unified-plan',
      iceCandidatePoolSize: 5,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// lib/pages/meeting_page.dart
// Full Flutter meeting room using LiveKit + your backend config
// ─────────────────────────────────────────────────────────────────────────────

/*
import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import 'livekit_config.dart';

class MeetingPage extends StatefulWidget {
  final String roomCode;
  final String authToken;
  final String displayName;
  const MeetingPage({super.key, required this.roomCode, required this.authToken, required this.displayName});

  @override
  State<MeetingPage> createState() => _MeetingPageState();
}

class _MeetingPageState extends State<MeetingPage> {
  Room? _room;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _connect();
  }

  Future<void> _connect() async {
    try {
      // 1. Fetch token + RTCConfiguration from your backend
      final config = await LiveKitConfig.load(
        roomCode:    widget.roomCode,
        authToken:   widget.authToken,
        displayName: widget.displayName,
        relayOnly:   false,   // auto-detect restrictive networks
      );

      // 2. Create LiveKit Room with your backend's RTCConfiguration
      final room = Room(
        roomOptions: RoomOptions(
          rtcConfiguration: config.rtcConfig,   // ← your TURN/STUN servers
          dynacast:         true,               // adaptive bitrate layers
          adaptiveStream:    true,              // auto-adjust for bandwidth
          defaultVideoPublishOptions: const VideoPublishOptions(
            videoCodec:    'vp9',
            simulcast:     true,
            videoEncoding: VideoEncoding(maxBitrate: 2000000, maxFramerate: 30),
          ),
          defaultAudioPublishOptions: const AudioPublishOptions(
            echoCancellation: true,
            noiseSuppression: true,
            audioBitrate:     32000,
          ),
        ),
      );

      // 3. Add event listeners
      room.addListener(_onRoomChanged);

      // 4. Connect to LiveKit server
      await room.connect(
        config.serverUrl,   // wss://your-app.livekit.cloud
        config.token,       // JWT from your backend
        connectOptions: const ConnectOptions(
          autoSubscribe: true,
          rtcConfig: null,  // null = use room's rtcConfig from RoomOptions
        ),
      );

      // 5. Enable camera + microphone
      await room.localParticipant?.setCameraEnabled(true);
      await room.localParticipant?.setMicrophoneEnabled(true);

      setState(() { _room = room; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _onRoomChanged() => setState(() {});

  @override
  void dispose() {
    _room?.removeListener(_onRoomChanged);
    _room?.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_error != null) return Scaffold(body: Center(child: Text('Error: $_error')));

    final room = _room!;
    final participants = [room.localParticipant!, ...room.remoteParticipants.values];

    return Scaffold(
      backgroundColor: const Color(0xFF0B1510),
      body: SafeArea(
        child: Column(
          children: [
            // Video grid
            Expanded(
              child: GridView.builder(
                itemCount: participants.length,
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 300, childAspectRatio: 16 / 9,
                ),
                itemBuilder: (ctx, i) {
                  final p = participants[i];
                  return ParticipantWidget(participant: p);
                },
              ),
            ),
            // Controls bar
            _ControlsBar(room: room),
          ],
        ),
      ),
    );
  }
}

class _ControlsBar extends StatelessWidget {
  final Room room;
  const _ControlsBar({required this.room});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF101D17),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          IconButton(
            icon: Icon(room.localParticipant?.isMicrophoneEnabled() ?? true
                ? Icons.mic : Icons.mic_off),
            color: Colors.white,
            onPressed: () => room.localParticipant?.setMicrophoneEnabled(
              !(room.localParticipant?.isMicrophoneEnabled() ?? true)),
          ),
          IconButton(
            icon: Icon(room.localParticipant?.isCameraEnabled() ?? true
                ? Icons.videocam : Icons.videocam_off),
            color: Colors.white,
            onPressed: () => room.localParticipant?.setCameraEnabled(
              !(room.localParticipant?.isCameraEnabled() ?? true)),
          ),
          IconButton(
            icon: const Icon(Icons.screen_share),
            color: Colors.white,
            onPressed: () => room.localParticipant?.setScreenShareEnabled(true),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              await room.disconnect();
              Navigator.of(context).pop();
            },
            child: const Text('Leave'),
          ),
        ],
      ),
    );
  }
}
*/
