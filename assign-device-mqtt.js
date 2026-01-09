const mqtt = require('mqtt');

const broker = 'mqtt://broker.hivemq.com:1883';
const topic = 'koi/sensors/WQ_000/command';
const message = JSON.stringify({
  command: 'assign',
  pondId: 3
});

console.log('========================================');
console.log('Assigning Water Quality Device via MQTT');
console.log('========================================');
console.log('');
console.log('Connecting to:', broker);
console.log('Topic:', topic);
console.log('Message:', message);
console.log('');

const client = mqtt.connect(broker);

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker');
  console.log('📤 Publishing assignment command...');
  
  client.publish(topic, message, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Error publishing:', err);
      client.end();
      process.exit(1);
    } else {
      console.log('✅ Command published successfully!');
      console.log('');
      console.log('Check ESP32 Serial Monitor for:');
      console.log('  ✓ Assigned to Pond: 3');
      console.log('  🏊 Pond: 3 | pH: X.XX | ...');
      console.log('');
      console.log('========================================');
      
      setTimeout(() => {
        client.end();
        process.exit(0);
      }, 1000);
    }
  });
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err.message);
  process.exit(1);
});
