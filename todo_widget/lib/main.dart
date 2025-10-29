import 'package:flutter/material.dart';
import 'package:home_widget/home_widget.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TodoWidgetApp());
}

// 백그라운드에서 위젯 업데이트
@pragma('vm:entry-point')
void backgroundCallback(Uri? uri) async {
  if (uri?.host == 'updatetodos') {
    await updateWidget();
  }
}

Future<void> updateWidget() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final password = prefs.getString('password') ?? '43084308';
    
    final response = await http.get(
      Uri.parse('https://www.cdcdcd.kr/api/widget/todos?password=$password'),
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final todos = data['todos'] as List;
      
      // 위젯 데이터 저장
      await HomeWidget.saveWidgetData<int>('todo_count', todos.length);
      await HomeWidget.saveWidgetData<String>(
        'todos_json',
        json.encode(todos.take(5).toList()),
      );
      
      // 위젯 업데이트
      await HomeWidget.updateWidget(
        androidName: 'TodoWidgetProvider',
      );
    }
  } catch (e) {
    print('Error updating widget: $e');
  }
}

class TodoWidgetApp extends StatelessWidget {
  const TodoWidgetApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '할일 위젯',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.grey),
        useMaterial3: true,
      ),
      home: const TodoListScreen(),
    );
  }
}

class TodoListScreen extends StatefulWidget {
  const TodoListScreen({super.key});

  @override
  State<TodoListScreen> createState() => _TodoListScreenState();
}

class _TodoListScreenState extends State<TodoListScreen> {
  final _passwordController = TextEditingController();
  List<dynamic> _todos = [];
  bool _isLoading = false;
  bool _isAuthenticated = false;

  @override
  void initState() {
    super.initState();
    _loadPassword();
    HomeWidget.setAppGroupId('kr.cdcdcd.portal');
    HomeWidget.registerBackgroundCallback(backgroundCallback);
  }

  Future<void> _loadPassword() async {
    final prefs = await SharedPreferences.getInstance();
    final password = prefs.getString('password');
    if (password != null) {
      _passwordController.text = password;
      setState(() => _isAuthenticated = true);
      _loadTodos();
    }
  }

  Future<void> _login() async {
    final password = _passwordController.text;
    if (password == '43084308') {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('password', password);
      setState(() => _isAuthenticated = true);
      _loadTodos();
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('비밀번호가 올바르지 않습니다.')),
        );
      }
    }
  }

  Future<void> _loadTodos() async {
    setState(() => _isLoading = true);
    
    try {
      final prefs = await SharedPreferences.getInstance();
      final password = prefs.getString('password') ?? '43084308';
      
      final response = await http.get(
        Uri.parse('https://www.cdcdcd.kr/api/widget/todos?password=$password'),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        setState(() {
          _todos = data['todos'] ?? [];
        });
        
        // 위젯 업데이트
        await updateWidget();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('오류: $e')),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('password');
    setState(() {
      _isAuthenticated = false;
      _todos = [];
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_isAuthenticated) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('할일 위젯'),
          backgroundColor: Colors.grey[900],
          foregroundColor: Colors.white,
        ),
        body: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.check_circle_outline, size: 80, color: Colors.grey),
              const SizedBox(height: 24),
              const Text(
                'TO DO LIST',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                '비밀번호를 입력하세요',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: '비밀번호',
                  border: OutlineInputBorder(),
                ),
                onSubmitted: (_) => _login(),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _login,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.grey[900],
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.all(16),
                  ),
                  child: const Text('로그인'),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('할일 목록'),
        backgroundColor: Colors.grey[900],
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadTodos,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _todos.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.check_circle_outline, size: 64, color: Colors.grey),
                      SizedBox(height: 16),
                      Text('등록된 할일이 없습니다.'),
                    ],
                  ),
                )
              : ListView.builder(
                  itemCount: _todos.length,
                  padding: const EdgeInsets.all(16),
                  itemBuilder: (context, index) {
                    final todo = _todos[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        title: Text(
                          todo['task'] ?? '',
                          style: const TextStyle(fontWeight: FontWeight.w500),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 4),
                            Text('요청자: ${todo['requester'] ?? ''}'),
                            if (todo['dueDate'] != null)
                              Text('마감: ${todo['dueDate']}'),
                          ],
                        ),
                        isThreeLine: true,
                      ),
                    );
                  },
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _loadTodos,
        backgroundColor: Colors.grey[900],
        foregroundColor: Colors.white,
        icon: const Icon(Icons.widgets),
        label: const Text('위젯 업데이트'),
      ),
    );
  }

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }
}





