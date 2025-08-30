import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_tts/flutter_tts.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  bool firebaseReady = false;
  try { await Firebase.initializeApp(); firebaseReady = true; } catch (_) {}
  runApp(App(firebaseReady: firebaseReady));
}

const apiBase = String.fromEnvironment('API_BASE', defaultValue: 'http://10.0.2.2:8080');

class Skill { final int id; final String name; Skill(this.id, this.name);
  factory Skill.fromJson(Map<String,dynamic> j) => Skill(j['id'] as int, j['name'] as String);
}

enum Mode { employer, worker }
Map<String, Map<String,String>> i18n = {
  'en': {'app':'MazdoorHub','post_job':'Post Job','job_type':'Job Type','job_title':'Job Title','track':'Track Now','rate':'Rate','google':'Google','facebook':'Facebook','availability':'Availability','preferences':'Preferences','min_rate':'Min Fixed (PKR)','radius':'Radius (km)','save':'Save','sos':'SOS','navigate':'Navigate'},
  'ur': {'app':'مزدور حب','post_job':'کام پوسٹ کریں','job_type':'کام کی قسم','job_title':'عنوان','track':'ٹریک کریں','rate':'ریٹنگ دیں','google':'گوگل','facebook':'فیس بک','availability':'دستیابی','preferences':'ترجیحات','min_rate':'کم از کم اجرت (روپے)','radius':'رداس (کلومیٹر)','save':'محفوظ کریں','sos':'ایس او ایس','navigate':'رستہ دکھائیں'}
};

class App extends StatefulWidget { final bool firebaseReady; const App({super.key, required this.firebaseReady});
  @override State<App> createState() => _AppState(); }
class _AppState extends State<App> {
  Mode mode = Mode.employer; String lang='en';
  @override Widget build(BuildContext context) => MaterialApp(
    title: i18n[lang]!['app']!, theme: ThemeData(useMaterial3: true),
    home: HomePage(firebaseReady: widget.firebaseReady, mode: mode, lang: lang, onToggleMode:(m)=>setState(()=>mode=m), onLang:(l)=>setState(()=>lang=l))
  );
}

class HomePage extends StatefulWidget {
  final bool firebaseReady; final Mode mode; final String lang;
  final void Function(Mode) onToggleMode; final void Function(String) onLang;
  const HomePage({super.key, required this.firebaseReady, required this.mode, required this.lang, required this.onToggleMode, required this.onLang});
  @override State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final FlutterTts tts = FlutterTts(); bool speakHints=false;
  String? jwt; String? employerId; String? workerId;
  List<Skill> skills=[]; Skill? selected;
  final titleCtrl = TextEditingController(text: "Plumber needed");
  double lat=24.8607, lon=67.0011; String? lastJobId; Timer? _pollTimer; Timer? heartbeatTimer; double? workerLat, workerLon; String? acceptedWorkerId; String? jobStatus;
  final commentCtrl = TextEditingController(); int ratingScore=5;
  bool available=false; final minRateCtrl = TextEditingController(text:"0"); final radiusCtrl = TextEditingController(text:"8");

  @override void initState(){ super.initState(); _loadSkills(); heartbeatTimer = Timer.periodic(const Duration(minutes:5), (_)=> sendHeartbeat()); }
  @override void dispose(){
    _pollTimer?.cancel();
    heartbeatTimer?.cancel();
    commentCtrl.dispose();
    // Dispose controllers to free resources
    titleCtrl.dispose();
    minRateCtrl.dispose();
    radiusCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSkills() async {
    try { final r = await http.get(Uri.parse('$apiBase/v1/skills')); if(r.statusCode==200){ final List d=jsonDecode(r.body); setState(()=> skills = d.map((e)=>Skill.fromJson(e)).toList()); } } catch(_){}
  }

  void startPollingTracker(){ _pollTimer?.cancel(); _pollTimer = Timer.periodic(const Duration(seconds:3), (_)=> pollTracker()); }
  void stopPollingTracker(){ _pollTimer?.cancel(); }

  Future<void> pollTracker() async {
    if (lastJobId==null) return;
    final r = await http.post(Uri.parse('$apiBase/v1/jobs/$lastJobId/tracker'));
    if (r.statusCode==200) {
      final j = jsonDecode(r.body);
      setState(() {
        jobStatus = j['status'] as String?;
        if (j['worker']!=null) { acceptedWorkerId = j['worker']['id'] as String?; workerLat = (j['worker']['lat'] as num?)?.toDouble(); workerLon = (j['worker']['lon'] as num?)?.toDouble(); }
        else { acceptedWorkerId=null; workerLat=null; workerLon=null; }
      });
      if (jobStatus=='completed') stopPollingTracker();
    }
  }

  Future<void> postJob() async {
    if (selected==null || employerId==null) return;
    final r = await http.post(Uri.parse('$apiBase/v1/jobs'),
      headers:{'Content-Type':'application/json', if(jwt!=null) 'Authorization':'Bearer $jwt'},
      body: jsonEncode({"employer_id":employerId,"skill_id":selected!.id,"title":titleCtrl.text,"lat":lat,"lon":lon,"budget_type":"fixed","budget_amount":2500,"guarantee_min_pkr":2000})
    );
    if (r.statusCode==200 || r.statusCode==201) {
      final b = jsonDecode(r.body); setState((){ lastJobId=b['id']; jobStatus='posted'; workerLat=null; workerLon=null; }); startPollingTracker();
      if (speakHints) { await tts.speak('Job posted'); }
    }
  }

  Future<void> signInWithGoogle() async {
    if (!widget.firebaseReady) return;
    final u = await GoogleSignIn().signIn(); if(u==null) return;
    final a = await u.authentication;
    final c = GoogleAuthProvider.credential(accessToken:a.accessToken, idToken:a.idToken);
    await FirebaseAuth.instance.signInWithCredential(c);
    final idt = await FirebaseAuth.instance.currentUser!.getIdToken(true);
    final res = await http.post(Uri.parse('$apiBase/v1/auth/social'), headers:{'Content-Type':'application/json'}, body: jsonEncode({'idToken':idt,'role': widget.mode==Mode.worker?'worker':'employer'}));
    final j = jsonDecode(res.body); setState(()=> jwt=j['token']);
    final uid = j['user']['id'] as String?; if (uid!=null){ if (widget.mode==Mode.worker) { workerId = uid; } else { employerId = uid; } }
  }
  Future<void> signInWithFacebook() async {
    if (!widget.firebaseReady) return;
    final fb = await FacebookAuth.instance.login(permissions:['email']); if (fb.status != LoginStatus.success) return;
    final c = FacebookAuthProvider.credential(fb.accessToken!.token); await FirebaseAuth.instance.signInWithCredential(c);
    final idt = await FirebaseAuth.instance.currentUser!.getIdToken(true);
    final res = await http.post(Uri.parse('$apiBase/v1/auth/social'), headers:{'Content-Type':'application/json'}, body: jsonEncode({'idToken':idt,'role': widget.mode==Mode.worker?'worker':'employer'}));
    final j = jsonDecode(res.body); setState(()=> jwt=j['token']);
    final uid = j['user']['id'] as String?; if (uid!=null){ if (widget.mode==Mode.worker) { workerId = uid; } else { employerId = uid; } }
  }

  Future<void> savePrefs() async {
    final body = {"preferred_radius_km": int.tryParse(radiusCtrl.text) ?? 8, "min_fixed_pkr": int.tryParse(minRateCtrl.text) ?? 0, "accept_under_min": false};
    await http.patch(Uri.parse('$apiBase/v1/workers/$workerId/preferences'), headers:{'Content-Type':'application/json'}, body: jsonEncode(body));
  }
  Future<void> toggleAvailability() async {
    if (workerId==null) return;
    available = !available; setState((){});
    await http.patch(Uri.parse('$apiBase/v1/workers/$workerId/availability'), headers:{'Content-Type':'application/json'}, body: jsonEncode({"availability": available}));
    if (speakHints) { await tts.speak(available? 'Available' : 'Unavailable'); }
  }
  Future<void> sendSOS() async {
    await http.post(Uri.parse('$apiBase/v1/safety/sos'), headers:{'Content-Type':'application/json'}, body: jsonEncode({"to":"+923001234567","worker_id":workerId,"lat":workerLat??lat,"lon":workerLon??lon,"job_id":lastJobId}));
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('SOS sent.')));
  }
  Future<void> navigateToJob() async {
    final Uri u = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lon');
    if (await canLaunchUrl(u)) await launchUrl(u, mode: LaunchMode.externalApplication);
  }
  Future<void> submitRating() async {
    if (lastJobId==null || acceptedWorkerId==null) return;
    final payload = {"job_id":lastJobId,"rater_id":employerId,"ratee_id":acceptedWorkerId,"score":ratingScore,"comment":commentCtrl.text};
    await http.post(Uri.parse('$apiBase/v1/ratings'), headers:{'Content-Type':'application/json', if(jwt!=null) 'Authorization':'Bearer $jwt'}, body: jsonEncode(payload));
  }
  Future<void> peekSoftHold() async {
    if (lastJobId==null) return;
    await http.post(Uri.parse('$apiBase/v1/jobs/$lastJobId/peek'), headers:{'Content-Type':'application/json'}, body: jsonEncode({"worker_id": workerId}));
    if (speakHints) { await tts.speak('Soft hold placed'); }
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Soft hold attempted')));
  }
  Future<void> sendHeartbeat() async {
    final uid = widget.mode==Mode.worker? workerId : employerId;
    if (uid==null) return;
    await http.post(Uri.parse('$apiBase/v1/devices/heartbeat'), headers:{'Content-Type':'application/json'}, body: jsonEncode({"user_id": uid, "platform":"flutter"}));
  }

  @override Widget build(BuildContext context) {
    final t = i18n[widget.lang]!; final canRate = jobStatus=='completed' && acceptedWorkerId!=null;
    final topBar = Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children:[
      SegmentedButton<Mode>(segments: const [ButtonSegment(value:Mode.employer,label:Text('Employer')), ButtonSegment(value:Mode.worker,label:Text('Worker'))], selected:{widget.mode}, onSelectionChanged:(s)=> widget.onToggleMode(s.first)),
      DropdownButton<String>(value: widget.lang, items: const [DropdownMenuItem(value:'en',child:Text('EN')), DropdownMenuItem(value:'ur',child:Text('UR'))], onChanged: (v)=> widget.onLang(v??'en'))
    ]);
    final socialButtons = Row(mainAxisAlignment: MainAxisAlignment.center, children:[
      ElevatedButton(onPressed: widget.firebaseReady? signInWithGoogle : null, child: Text(t['google']!)),
      const SizedBox(width:12),
      ElevatedButton(onPressed: widget.firebaseReady? signInWithFacebook : null, child: Text(t['facebook']!)),
    ]);
    final map = Expanded(child: FlutterMap(options: MapOptions(initialCenter: LatLng(lat, lon), initialZoom: 12), children: [
      TileLayer(urlTemplate:"https://tile.openstreetmap.org/{z}/{x}/{y}.png", userAgentPackageName:'com.example.mazdoorhub'),
      MarkerLayer(markers: [
        Marker(point: LatLng(lat, lon), width: 40, height: 40, child: const Icon(Icons.location_pin, size: 40)),
        if (workerLat!=null && workerLon!=null) Marker(point: LatLng(workerLat!, workerLon!), width: 36, height: 36, child: const Icon(Icons.directions_run, size: 36)),
      ]),
    ]));
    return Scaffold(appBar: AppBar(title: Text(t['app']!)), body: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children:[
      Padding(padding: const EdgeInsets.all(8), child: topBar),
      Center(child: socialButtons),
      Row(mainAxisAlignment: MainAxisAlignment.center, children:[ const SizedBox(width:8), const Text('TTS'), Switch(value:speakHints, onChanged:(v)=> setState(()=>speakHints=v)) ]),
      if (widget.mode==Mode.employer) ...[
        Padding(padding: const EdgeInsets.all(8.0), child: DropdownButtonFormField<Skill>(decoration: InputDecoration(labelText:t['job_type']), value: selected, items: skills.map((s)=>DropdownMenuItem(value:s, child: Text(s.name))).toList(), onChanged:(s)=> setState(()=> selected=s))),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 8), child: TextField(controller:titleCtrl, decoration: InputDecoration(labelText:t['job_title']))),
        Row(mainAxisAlignment: MainAxisAlignment.center, children:[
          ElevatedButton(onPressed: postJob, child: Text(t['post_job']!)),
          const SizedBox(width:8),
          ElevatedButton(onPressed: (lastJobId==null)? null : pollTracker, child: Text(t['track']!)),
          const SizedBox(width:8),
          ElevatedButton(onPressed: canRate? submitRating : null, child: Text(t['rate']!)),
        ]),
        map,
      ] else ...[
        Padding(padding: const EdgeInsets.symmetric(horizontal:12, vertical:6), child: Row(children:[ Text(t['availability']!), const SizedBox(width:8), Switch(value:available, onChanged: (_)=> toggleAvailability()) ])),
        ExpansionTile(title: Text(t['preferences']!), children:[ Padding(padding: const EdgeInsets.symmetric(horizontal:12), child: Row(children:[
          Expanded(child: TextField(controller: minRateCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText:t['min_rate']))),
          const SizedBox(width:12),
          Expanded(child: TextField(controller: radiusCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText:t['radius']))),
          const SizedBox(width:12),
          ElevatedButton(onPressed: savePrefs, child: Text(t['save']!))
        ])) ]),
        Row(mainAxisAlignment: MainAxisAlignment.center, children:[
          ElevatedButton(onPressed: navigateToJob, child: Text(t['navigate']!)),
          const SizedBox(width:8),
          ElevatedButton(onPressed: sendSOS, child: Text(t['sos']!)),
          const SizedBox(width:8),
          ElevatedButton(onPressed: peekSoftHold, child: const Text('Soft-hold')),
        ]),
        map,
      ]
    ]));
  }
}
