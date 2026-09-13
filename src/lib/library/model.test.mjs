import assert from "node:assert/strict";
import test from "node:test";
import {parseFood,parseUtensil,parseCalibration,recordId,validateImage,MAX_IMAGE_BYTES} from "./model.ts";
const form = (values) => {const result=new FormData();for(const [key,value] of Object.entries(values))result.set(key,value);return result;};
const food={name:"Example oats",serving_basis:"g",serving_quantity:"100",calories:"390",protein:"12.5",carbs:"60",fat:"8",source:"Synthetic test label"};
test("food nutrients retain their explicit serving basis and source",()=>{
  const parsed=parseFood(form(food));assert.equal(parsed.serving_quantity,100);assert.equal(parsed.protein,12.5);assert.equal(parsed.source,food.source);
});
test("invalid food numbers, blank provenance and unsupported units are rejected",()=>{
  for(const value of ["-1","NaN","Infinity","1e3","0x10","1000001","1.234"])assert.throws(()=>parseFood(form({...food,calories:value})));
  assert.throws(()=>parseFood(form({...food,serving_quantity:"0"})));
  assert.throws(()=>parseFood(form({...food,serving_basis:"bowl"})));
  assert.throws(()=>parseFood(form({...food,source:" "})));
});
test("optional dimensions stay null; capacity and weight remain distinct",()=>{
  const utensil=parseUtensil(form({name:"Example bowl",type:"bowl",capacity_ml:"250",diameter_cm:"",height_cm:""}));
  assert.equal(utensil.capacity_ml,250);assert.equal(utensil.diameter_cm,null);
  assert.equal("full_serving_grams" in utensil,false);
  assert.throws(()=>parseUtensil(form({name:"Bowl",type:"bowl",capacity_ml:"-2"})));
});
test("calibrations require valid record IDs and a positive food mass",()=>{
  const data={utensil_id:"11111111-1111-4111-8111-111111111111",food_id:"22222222-2222-4222-8222-222222222222",full_serving_grams:"180.5"};
  assert.equal(parseCalibration(form(data)).full_serving_grams,180.5);
  assert.throws(()=>parseCalibration(form({...data,food_id:"someone-else"})));
  assert.throws(()=>parseCalibration(form({...data,full_serving_grams:"0"})));
  assert.equal(recordId(form({})),null);
});
test("caller-supplied ownership and image paths are excluded from parsed records",()=>{
  assert.equal("user_id" in parseFood(form({...food,user_id:"attacker"})),false);
  assert.equal("reference_image_path" in parseUtensil(form({name:"Bowl",type:"bowl",reference_image_path:"other-user/photo.jpg"})),false);
});
test("image validation rejects type spoofing, SVG and oversized files",async()=>{
  const jpeg=new File([new Uint8Array([255,216,255,224])],"test.jpg",{type:"image/jpeg"});
  assert.equal(await validateImage(jpeg),"jpg");
  await assert.rejects(validateImage(new File(["not an image"],"fake.png",{type:"image/png"})));
  await assert.rejects(validateImage(new File(["<svg/>"],"x.svg",{type:"image/svg+xml"})));
  await assert.rejects(validateImage(new File([new Uint8Array(MAX_IMAGE_BYTES+1)],"large.jpg",{type:"image/jpeg"})));
});
