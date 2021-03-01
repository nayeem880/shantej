# -*- coding: utf-8 -*-

# Define your item pipelines here
#
# Don't forget to add your pipeline to the ITEM_PIPELINES setting
# See: https://doc.scrapy.org/en/latest/topics/item-pipeline.html
import datetime
import os
import pymongo
import shutil

class ExtractEmailsPipeline(object):
    collection_name = ""

    def open_spider(self, spider):
        if spider.name == 'guestpostscraper':
            if os.path.isfile('guestpostscraper.csv'):
                os.remove('guestpostscraper.csv')
            self.collection_name = 'urls'
            
        if spider.name == 'get_emails':
            if os.path.isfile('get_emails.csv'):
                os.remove('get_emails.csv')
            self.collection_name = 'emails'
        
        # PRODUCTION DB INFO
        # mongodb+srv://admin-santhej:<password>@cluster0.3dv1a.mongodb.net/<dbname>?retryWrites=true&w=majority
        # self.client = pymongo.MongoClient('mongodb+srv://admin-santhej:test1234@cluster0.3dv1a.mongodb.net/retryWrites=true&w=majority')
        # self.db = self.client["scraper_db"]

        # DEVELOPMENT ENV DB INFO
        self.client = pymongo.MongoClient('mongodb://localhost:27017')
        self.db = self.client["scraper_db"]

    def process_item(self, item, spider):
        if spider.name == 'get_emails':
            if item['email'] != 'NA':
                if item['da'] == 'NA':
                    print(f'ERROR: Skipping db insertion because DA for {item["website"]} was not found')
                elif item['pa'] == 'NA':
                    print(f'ERROR: Skipping db insertion because PA for {item["website"]} was not found')
                elif item['cf'] == 'NA':
                    print(f'ERROR: Skipping db insertion because CF for {item["website"]} was not found')
                elif item['tf'] == 'NA':
                    print(f'ERROR: Skipping db insertion because TF for {item["website"]} was not found')
                else:
                    print(f'get_emails db Insert -> {item}')
                    self.db[self.collection_name].update_one(
                        {"url": item["url"]}, {"$set": item}, upsert=True
                    )
            else:
                print(f'ERROR: Skipping db insertion because no email was not found for {item["website"]}')
        else:
            print(f'guestpostscraper bb Insert -> {item}')
            self.db[self.collection_name].update_one(
                {"website_url": item["website_url"]}, {"$set": item}, upsert=True
            )
        return item

    def close_spider(self, spider):
        if spider.name == 'guestpostscraper':
            if os.path.isfile('guestpostscraper.csv'):
                shutil.copyfile('guestpostscraper.csv', 'guestpostscraper.out.csv')
        
        if spider.name == 'get_emails':
            if os.path.isfile('get_emails.csv'):
                shutil.copyfile('get_emails.csv', 'get_emails.out.csv')
        
        self.client.close()