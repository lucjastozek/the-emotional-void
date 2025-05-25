#include "DHT.h"
#include <ArduinoJson.h>
#define DHTPIN 2
#define DHTTYPE DHT11
#define samp_siz 4 
#define rise_threshold 5 
const int LED_ON = LOW;
const int LED_OFF = HIGH;
const int GSR = A2;
int gsrSensorValue = 0;
int gsrAverage = 0;

float humidity = 0.0;
float temperature = 0.0;

int heartBeatSensorPin = 0;

// heart beat stuff
float reads[samp_siz], sum; 
long int now, ptr; 
float last, reader, start; 
float first, second, third, before, print_value; 
bool rising; 
int rise_count; 
int n; 
long int last_beat; 

unsigned long lastMeasuringTime = 0;
const unsigned long measuringInterval = 1000;

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
  for (int i = 0; i < samp_siz; i++) 
    reads[i] = 0; 
  sum = 0; 
  ptr = 0; 
}

void tempHumidity() {
  humidity = dht.readHumidity();
  temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Failed to read from DHT sensor!");
  }
}

void gsr() {
  long sum=0;

  for (int i = 0; i < 10; i++) {
    gsrSensorValue = analogRead(GSR);

    sum += gsrSensorValue;
  }

  gsrAverage = sum/10;

  // Serial.print("min:0, max:1023, gsr:");
  // Serial.println(gsrAverage);
}

void heartBeat() {
  digitalWrite(LEDR,LED_OFF);
  // calculate an average of the sensor during a 20 ms period (eliminating the 50 Hz noise caused by electric light)
  n = 0; 
  start = millis(); 
  reader = 0.; 
  do { 
    reader += analogRead(heartBeatSensorPin); 
    n++; 
    now = millis(); 
  } while (now < start + 20);

  reader /= n;  // Average 

  // Update he array
  sum -= reads[ptr]; 
  sum += reader; 
  reads[ptr] = reader; 
  last = sum / samp_siz; // average of the values in the array

  // check for a rising curve (= a heart beat) 
  if (last > before) { 
    rise_count++; 
    if (!rising && rise_count > rise_threshold) { 
      // Record the time since last beat, keep track of the two previous times (first, second, third) to get a weighed average. 
      // The rising flag prevents us from detecting the same rise more than once. 
      rising = true; 
      first = millis() - last_beat; 
      last_beat = millis(); 

      // Calculate the weighed average of heartbeat rate according to the three last beats 
      print_value = 60000. / (0.4 * first + 0.3 * second + 0.3 * third); 

      digitalWrite(LEDR,LED_ON);
      // Serial.print("hr:"); 
      // Serial.println(print_value);
      StaticJsonDocument<64> heartbeat;
      heartbeat["event"] = "heartbeat";

      serializeJson(heartbeat, Serial);
      Serial.println();

      third = second; 
      second = first; 
    } 
  } 
  else { 
    rising = false; 
    rise_count = 0; 
  } 

  before = last; 
  ptr++; 
  ptr %= samp_siz; 
}

void loop() {
  heartBeat();
  
  unsigned long currentMillis = millis();

  if (currentMillis - lastMeasuringTime >= measuringInterval) {
    gsr();
    tempHumidity();
    lastMeasuringTime = currentMillis;

    StaticJsonDocument<256> doc;

    doc["event"] = "measurement";

    JsonObject measurements = doc.createNestedObject("measurements");

    measurements["gsr"] = gsrAverage;
    measurements["temperature"] = temperature;
    measurements["humidity"] = humidity;

    serializeJson(doc, Serial);
    Serial.println();
  }
}
