import 'package:flutter/material.dart';

void main() {
  runApp(const ServiceMarketplaceApp());
}

class ServiceMarketplaceApp extends StatelessWidget {
  const ServiceMarketplaceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Service Marketplace',
      home: Scaffold(
        appBar: AppBar(
          title: const Text('Service Marketplace'),
        ),
        body: const Center(
          child: Text(
            'Welcome to Service Marketplace',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }
}