import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../application/admin_provider.dart';
import '../../../core/localization/app_localizations.dart';

class AdminCreateRideScreen extends StatefulWidget {
  const AdminCreateRideScreen({super.key});

  @override
  State<AdminCreateRideScreen> createState() => _AdminCreateRideScreenState();
}

class _AdminCreateRideScreenState extends State<AdminCreateRideScreen> {
  final _formKey = GlobalKey<FormState>();
  
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _pickupLatController = TextEditingController();
  final _pickupLngController = TextEditingController();
  final _pickupNameController = TextEditingController();
  final _dropoffLatController = TextEditingController();
  final _dropoffLngController = TextEditingController();
  final _dropoffNameController = TextEditingController();
  // Using a hardcoded ID for now since we don't have a ServiceType fetcher in Phase 8 yet.
  // In production, this would be a dropdown populated from backend.
  final _serviceTypeIdController = TextEditingController(text: 'standard-id');

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AdminProvider>();

    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('create_phone_ride')),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Customer Name'),
              validator: (v) => v!.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phoneController,
              decoration: const InputDecoration(labelText: 'Customer Phone'),
              validator: (v) => v!.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _pickupNameController,
              decoration: const InputDecoration(labelText: 'Pickup Address'),
              validator: (v) => v!.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _pickupLatController,
                    decoration: const InputDecoration(labelText: 'Pickup Lat'),
                    keyboardType: TextInputType.number,
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextFormField(
                    controller: _pickupLngController,
                    decoration: const InputDecoration(labelText: 'Pickup Lng'),
                    keyboardType: TextInputType.number,
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _dropoffNameController,
              decoration: const InputDecoration(labelText: 'Dropoff Address'),
              validator: (v) => v!.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _dropoffLatController,
                    decoration: const InputDecoration(labelText: 'Dropoff Lat'),
                    keyboardType: TextInputType.number,
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextFormField(
                    controller: _dropoffLngController,
                    decoration: const InputDecoration(labelText: 'Dropoff Lng'),
                    keyboardType: TextInputType.number,
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: provider.state == AdminState.loading ? null : _submit,
              child: provider.state == AdminState.loading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : Text(context.tr('create')),
            ),
            if (provider.errorMessage != null)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Text(
                  provider.errorMessage!,
                  style: const TextStyle(color: Colors.red),
                  textAlign: TextAlign.center,
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final success = await context.read<AdminProvider>().createPhoneRide(
      customerName: _nameController.text,
      customerPhone: _phoneController.text,
      pickupLat: double.tryParse(_pickupLatController.text) ?? 0.0,
      pickupLng: double.tryParse(_pickupLngController.text) ?? 0.0,
      pickupName: _pickupNameController.text,
      dropoffLat: double.tryParse(_dropoffLatController.text) ?? 0.0,
      dropoffLng: double.tryParse(_dropoffLngController.text) ?? 0.0,
      dropoffName: _dropoffNameController.text,
      serviceTypeId: _serviceTypeIdController.text, // Normally selected from dropdown
    );

    if (success && mounted) {
      Navigator.pop(context); // Go back to list
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Phone ride dispatched successfully!')),
      );
    }
  }
}
